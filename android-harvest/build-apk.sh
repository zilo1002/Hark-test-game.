#!/bin/bash
# Builds the debug APK without Gradle, straight from the Android SDK pieces in the
# auto-clicker toolchain (/workspace/work/tc: JDK 17, platform android-34, build-tools 34).
#   ./build-apk.sh            → build/banmu-harvest-debug.apk (+ copy to /workspace/work/out/)
# In CI (GitHub Actions) set SDK=$ANDROID_HOME and keep the runner's JAVA_HOME; OUT_DIR picks where the copy goes.
set -euo pipefail
VERSION_CODE=18
VERSION_NAME=4.7.1
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
( cd "$HERE/../harvest" && tar cf - index.html style.css js vendor models ) | ( cd "$B/assets/harvest" && tar xf - )
"$AAPT2" compile --dir "$APP/res" -o "$B/res/res.zip"
sed 's#<manifest xmlns:android="http://schemas.android.com/apk/res/android">#<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.zilo.banmuharvest">#' "$APP/AndroidManifest.xml" > "$B/AndroidManifest.xml"
"$AAPT2" link -I "$JAR" --manifest "$B/AndroidManifest.xml" -o "$B/base.apk" --java "$B/gen" -A "$B/assets" "$B/res/res.zip" --min-sdk-version 24 --target-sdk-version 34 --version-code $VERSION_CODE --version-name $VERSION_NAME
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$JAR" -classpath "$JAR" -d "$B/classes" -Xlint:-options $(find "$APP/java" "$B/gen" -name '*.java')
java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 --release --min-api 24 --lib "$JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')
cp "$B/base.apk" "$B/unsigned.apk"; ( cd "$B/dex" && zip -q -j "$B/unsigned.apk" classes.dex )
"$ZIPALIGN" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"
KS=$HERE/debug.keystore
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storetype pkcs12 -storepass android -keypass android -alias androiddebugkey -dname "CN=Android Debug,O=Android,C=US" -keyalg RSA -keysize 2048 -validity 10000 >/dev/null
java -jar "$BT/lib/apksigner.jar" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey --out "$B/banmu-harvest-debug.apk" "$B/aligned.apk"
java -jar "$BT/lib/apksigner.jar" verify --print-certs "$B/banmu-harvest-debug.apk" | head -3
mkdir -p "$OUT_DIR" && cp "$B/banmu-harvest-debug.apk" "$OUT_DIR/banmu-harvest-debug.apk"
ls -la "$B/banmu-harvest-debug.apk"
