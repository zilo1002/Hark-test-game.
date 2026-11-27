package com.zilo.banmuharvest;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Environment;
import android.provider.Settings;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.DisplayCutout;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * 半亩·丰收 as an offline Android app: a full-screen landscape WebView that serves the game
 * from the APK's assets under https://appassets.androidplatform.net/ (a secure origin, so ES
 * modules, WebGL and localStorage all work without a network), plus a vibration bridge.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/harvest/index.html";
    private WebView web;
    private int[] cut = { 0, 0, 0, 0 };

    private void pushCutout() {
        if (web == null) return;
        web.evaluateJavascript("(function(s){s.setProperty('--cut-l','" + cut[0] + "px');s.setProperty('--cut-r','" + cut[1] + "px');s.setProperty('--cut-t','" + cut[2] + "px');s.setProperty('--cut-b','" + cut[3] + "px');window.dispatchEvent(new Event('resize'));})(document.documentElement.style)", null);
    }

    /** JS: window.AndroidHaptics.vibrate(ms, amplitude 1..255) */
    public static final class Haptics {
        private final Vibrator vib;
        Haptics(Context c) { vib = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE); }

        @JavascriptInterface
        public void vibrate(int ms, int amp) {
            if (vib == null || !vib.hasVibrator()) return;
            long d = Math.max(1, Math.min(1000, ms));
            int a = Math.max(1, Math.min(255, amp));
            try {
                if (Build.VERSION.SDK_INT >= 26) {
                    vib.vibrate(VibrationEffect.createOneShot(d, vib.hasAmplitudeControl() ? a : VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vib.vibrate(d);
                }
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public boolean hasAmplitudeControl() {
            return vib != null && Build.VERSION.SDK_INT >= 26 && vib.hasAmplitudeControl();
        }
    }

    /** JS: window.AndroidApp.getVersionName() / .openUrl(url) — the About page + update check.
     *  getVersionName reads the installed package's versionName (same value in both build
     *  paths: Gradle versionName and the direct-SDK --version-name), so the game never
     *  hard-codes its own version. openUrl hands a link to the system browser, which is
     *  what downloads the new APK; tapping the finished download starts the installer. */
    public static final class AndroidApp {
        private final Activity act;
        AndroidApp(Activity a) { act = a; }

        @JavascriptInterface
        public String getVersionName() {
            try { return act.getPackageManager().getPackageInfo(act.getPackageName(), 0).versionName; }
            catch (Exception e) { return ""; }
        }

        /** 6.2.6: download the new APK inside the app (app-private Downloads folder), open the installer
         *  when it finishes, and let the next launch delete it — no stray APKs left on the phone. */
        @JavascriptInterface
        public boolean downloadUpdate(String url, String ver) {
            try { return ((MainActivity) act).startUpdateDownload(url, ver); } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public void openUrl(String url) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                act.startActivity(i);
            } catch (Exception ignored) { }
        }
    }

    // ---------------------------------------------------------------- in-app update download
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private long updId = -1, pendingInstall = -1;
    private BroadcastReceiver dlRecv;

    private SharedPreferences prefs() { return getSharedPreferences("update", MODE_PRIVATE); }

    private void note(final String msg) {
        if (web == null) return;
        web.post(new Runnable() { @Override public void run() {
            if (web != null) web.evaluateJavascript("(function(t){var n=document.getElementById('aboutNote');if(n)n.textContent=t;})(" + JSONObject.quote(msg) + ")", null);
        }});
    }

    private int dlStatus(DownloadManager dm, long id) {
        Cursor c = null;
        try {
            c = dm.query(new DownloadManager.Query().setFilterById(id));
            if (c != null && c.moveToFirst()) return c.getInt(c.getColumnIndex(DownloadManager.COLUMN_STATUS));
        } catch (Exception ignored) {
        } finally { if (c != null) c.close(); }
        return -1;
    }

    /** Delete downloaded update APKs. Runs on every launch: once the app opens again the update is
     *  installed (or was abandoned), so the file is no longer needed. A download still running is kept. */
    private void cleanOldApks() {
        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        long id = prefs().getLong("id", -1);
        if (dm != null && id >= 0) {
            int st = dlStatus(dm, id);
            if (st == DownloadManager.STATUS_RUNNING || st == DownloadManager.STATUS_PENDING || st == DownloadManager.STATUS_PAUSED) { updId = id; return; }
            try { dm.remove(id); } catch (Exception ignored) { }
            prefs().edit().remove("id").apply();
        }
        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        File[] fs = dir == null ? null : dir.listFiles();
        if (fs != null) for (File f : fs) if (f.getName().toLowerCase().endsWith(".apk")) { try { f.delete(); } catch (Exception ignored) { } }
        File[] cs = getCacheDir().listFiles();
        if (cs != null) for (File f : cs) if (f.getName().toLowerCase().endsWith(".apk")) { try { f.delete(); } catch (Exception ignored) { } }
    }

    boolean startUpdateDownload(String url, String ver) {
        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null || getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) == null) return false;
        if (updId >= 0) { int st = dlStatus(dm, updId); if (st == DownloadManager.STATUS_RUNNING || st == DownloadManager.STATUS_PENDING) return true; }
        cleanOldApks();
        String v = ver == null ? "" : ver.replaceAll("[^0-9A-Za-z._-]", "");
        DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
        r.setTitle("半亩·丰收 v" + v);
        r.setMimeType(APK_MIME);
        r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
        r.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "banmu-harvest-" + v + ".apk");
        updId = dm.enqueue(r);
        prefs().edit().putLong("id", updId).apply();
        return true;
    }

    private void installDownloaded(long id) {
        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) return;
        if (dlStatus(dm, id) != DownloadManager.STATUS_SUCCESSFUL) { note("下载失败了，请检查网络后再点一次检查更新。"); return; }
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            pendingInstall = id;
            note("下载好了。请在弹出的设置里允许「安装未知应用」，返回后会自动开始安装。");
            try { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) { }
            return;
        }
        pendingInstall = -1;
        try {
            Uri u = dm.getUriForDownloadedFile(id);
            Intent in = new Intent(Intent.ACTION_VIEW);
            in.setDataAndType(u, APK_MIME);
            in.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(in);
            note("下载好了，正在打开安装。装好后旧安装包会自动删除。");
        } catch (Exception e) { note("没能打开安装程序，请稍后再试。"); }
    }

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("js", "text/javascript"); MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css"); MIME.put("png", "image/png"); MIME.put("jpg", "image/jpeg");
        MIME.put("svg", "image/svg+xml"); MIME.put("webp", "image/webp"); MIME.put("json", "application/json"); MIME.put("txt", "text/plain");
        MIME.put("wav", "audio/wav"); MIME.put("mp3", "audio/mpeg"); MIME.put("woff2", "font/woff2");
        MIME.put("glb", "model/gltf-binary");
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) {
            w.getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(0x6D, 0xBB, 0x33));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setTextZoom(100);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.addJavascriptInterface(new Haptics(this), "AndroidHaptics");
        web.addJavascriptInterface(new AndroidApp(this), "AndroidApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.isEmpty() || path.equals("/")) path = "/harvest/index.html";
                if (path.endsWith("/")) path += "index.html";
                String asset = path.substring(1);
                try {
                    InputStream in = getAssets().open(asset);
                    int dot = asset.lastIndexOf('.');
                    String ext = dot >= 0 ? asset.substring(dot + 1).toLowerCase() : "";
                    String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
                    WebResourceResponse r = new WebResourceResponse(mime, "utf-8", in);
                    Map<String, String> h = new HashMap<>();
                    h.put("Cache-Control", "no-cache");
                    h.put("Access-Control-Allow-Origin", "*");
                    r.setResponseHeaders(h);
                    return r;
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) { pushCutout(); }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !HOST.equals(req.getUrl().getHost());   // stay inside the game
            }
        });
        setContentView(web);
        // 6.2.6: clear update APKs left from the last update, then listen for the next download
        cleanOldApks();
        dlRecv = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                long id = i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id >= 0 && id == updId) installDownloaded(id);
            }
        };
        IntentFilter df = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(dlRecv, df, Context.RECEIVER_EXPORTED);
        else registerReceiver(dlRecv, df);
        // v4.1: some WebViews report env(safe-area-inset-*) as 0 around a camera cutout; hand the real
        // cutout insets to the page as CSS variables (--cut-l/r/t/b, in CSS px) so the HUD stays clear of it
        if (Build.VERSION.SDK_INT >= 28) {
            web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets ins) {
                    DisplayCutout c = ins.getDisplayCutout();
                    float d = getResources().getDisplayMetrics().density;
                    cut = c == null ? new int[] { 0, 0, 0, 0 } : new int[] { Math.round(c.getSafeInsetLeft() / d), Math.round(c.getSafeInsetRight() / d), Math.round(c.getSafeInsetTop() / d), Math.round(c.getSafeInsetBottom() / d) };
                    pushCutout();
                    return v.onApplyWindowInsets(ins);
                }
            });
        }
        hideSystemBars();
        if (saved != null) web.restoreState(saved);
        else web.loadUrl(START);
    }

    private void hideSystemBars() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onPause() {
        if (web != null) { web.onPause(); }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); }
        hideSystemBars();
        if (pendingInstall >= 0 && (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls())) installDownloaded(pendingInstall);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // back = open the in-game pause menu (or close the open dialog); from the farm screen it leaves the app
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript(
            "(function(){var m=[].slice.call(document.querySelectorAll('.modal')).filter(function(x){return !x.classList.contains('hidden')&&!x.classList.contains('dock')});"
          + "if(m.length){var b=m[m.length-1].querySelector('[data-close],#btnResume');if(b){b.click();return 'closed';}}"
          + "var bd=document.getElementById('btnBuildDone');if(bd&&document.body.classList.contains('inbuild')){bd.click();return 'closed';}var h=document.getElementById('hud');if(h&&!h.classList.contains('hidden')){document.getElementById('btnPause').click();return 'paused';}"
          + "return 'home';})()",
            new ValueCallback<String>() {
                @Override public void onReceiveValue(String v) { if (v != null && v.contains("home")) moveTaskToBack(true); }
            });
    }

    @Override
    protected void onDestroy() {
        if (dlRecv != null) { try { unregisterReceiver(dlRecv); } catch (Exception ignored) { } dlRecv = null; }
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
