package com.zilo.banmuharvest;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
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

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("js", "text/javascript"); MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css"); MIME.put("png", "image/png"); MIME.put("jpg", "image/jpeg");
        MIME.put("svg", "image/svg+xml"); MIME.put("json", "application/json"); MIME.put("txt", "text/plain");
        MIME.put("wav", "audio/wav"); MIME.put("mp3", "audio/mpeg"); MIME.put("woff2", "font/woff2");
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
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
