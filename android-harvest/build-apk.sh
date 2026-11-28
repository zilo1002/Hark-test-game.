#!/bin/bash
# Builds the debug APK without Gradle, straight from the Android SDK pieces in the
# auto-clicker toolchain (/workspace/work/tc: JDK 17, platform android-34, build-tools 34).
#   ./build-apk.sh            → build/banmu-harvest-debug.apk (+ copy to /workspace/work/out/)
# In CI (GitHub Actions) set SDK=$ANDROID_HOME and keep the runner's JAVA_HOME; OUT_DIR picks where the copy goes.
set -euo pipefail
VERSION_CODE=109
VERSION_NAME=6.2.9
TC=${TC:-/workspace/work/tc}
if [ -z "${SDK:-}" ]; then
  export JAVA_HOME=$TC/jdk-17.0.21+9
  SDK=$TC/sdk; AAPT2=${AAPT2:-$TC/sdkt/build-tools/aapt2}; ZIPALIGN=${ZIPALIGN:-$TC/sdkt/build-tools/zipalign}
fi
export PATH=$JAVA_HOME/bin:$PATH
BT=$SDK/build-tools/34.0.0; AAPT2=${AAPT2:-$BT/aapt2}; ZIPALIGN=${ZIPALIGN:-$BT/zipalign}
OUT_DIR=${OUT_DIR:-/workspace/work/out}
JAR=$SDK/platforms/android-34/android.jar
HERE=$(cd "$(dirname "$0")" && pwd); APP=$HERE/app/src/main; B=$HERE/build
rm -rf "$B"; mkdir -p "$B/res" "$B/gen" "$B/classes" "$B/dex" "$B/assets/harvest"
# game files → assets/harvest (offline copy of ../harvest; dev-only files stay out)
( cd "$HERE/../harvest" && tar cf - index.html style.css js vendor models assets ) | ( cd "$B/assets/harvest" && tar xf - )
# APK-only artwork: files in overrides/ replace the web copy inside the APK (the web game is left unchanged)
[ -d "$HERE/overrides" ] && cp -R "$HERE/overrides/." "$B/assets/harvest/"
python3 "$HERE/apk-patch/apply.py" "$B/assets/harvest"
"$AAPT2" compile --dir "$APP/res" -o "$B/res/res.zip"
sed 's#<manifest xmlns:android="http://schemas.android.com/apk/res/android">#<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.zilo.banmuharvest">#' "$APP/AndroidManifest.xml" > "$B/AndroidManifest.xml"
"$AAPT2" link -I "$JAR" --manifest "$B/AndroidManifest.xml" -o "$B/base.apk" --java "$B/gen" -A "$B/assets" "$B/res/res.zip" --min-sdk-version 28 --target-sdk-version 34 --version-code $VERSION_CODE --version-name $VERSION_NAME
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$JAR" -classpath "$JAR" -d "$B/classes" -Xlint:-options $(find "$APP/java" "$B/gen" -name '*.java')
java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 --release --min-api 28 --lib "$JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')
cp "$B/base.apk" "$B/unsigned.apk"; ( cd "$B/dex" && zip -q -j "$B/unsigned.apk" classes.dex )
"$ZIPALIGN" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"
# Signing: release key "Zilozarael" (release.keystore) with a v3 proof-of-rotation from the old debug key,
# so phones that have an older debug-signed build update in place (no uninstall, saves kept).
# v3-only (minSdk 28): v1/v2 would have to carry the old debug cert, which vivo reports as 没有开发者证书.
KS=$HERE/debug.keystore; RKS=$HERE/release.keystore; RPW=$(cat "$HERE/release.pass")
LIN=$B/lineage.bin
java -jar "$BT/lib/apksigner.jar" rotate --out "$LIN" \
  --old-signer --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey \
  --new-signer --ks "$RKS" --ks-type PKCS12 --ks-pass pass:$RPW --key-pass pass:$RPW --ks-key-alias zilozarael
java -jar "$BT/lib/apksigner.jar" sign --v1-signing-enabled false --v2-signing-enabled false --v3-signing-enabled true \
  --min-sdk-version 28 --lineage "$LIN" \
  --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey \
  --next-signer --ks "$RKS" --ks-type PKCS12 --ks-pass pass:$RPW --key-pass pass:$RPW --ks-key-alias zilozarael \
  --out "$B/banmu-harvest-debug.apk" "$B/aligned.apk"
java -jar "$BT/lib/apksigner.jar" verify -v --print-certs "$B/banmu-harvest-debug.apk" | head -20
mkdir -p "$OUT_DIR" && cp "$B/banmu-harvest-debug.apk" "$OUT_DIR/banmu-harvest-debug.apk"
python3 "$HERE/check-apk-doll-assets.py" "$B/banmu-harvest-debug.apk"
ls -la "$B/banmu-harvest-debug.apk"
