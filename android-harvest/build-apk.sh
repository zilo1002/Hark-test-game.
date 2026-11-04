#!/bin/bash
# Builds the debug APK without Gradle, straight from the Android SDK pieces in the
# auto-clicker toolchain (/workspace/work/tc: JDK 17, platform android-34, build-tools 34).
#   ./build-apk.sh            → build/banmu-harvest-debug.apk (+ copy to /workspace/work/out/)
set -euo pipefail
TC=${TC:-/workspace/work/tc}
export JAVA_HOME=$TC/jdk-17.0.21+9; export PATH=$JAVA_HOME/bin:$PATH
SDK=$TC/sdk; BT=$SDK/build-tools/34.0.0; AAPT2=${AAPT2:-$TC/sdkt/build-tools/aapt2}; ZIPALIGN=${ZIPALIGN:-$TC/sdkt/build-tools/zipalign}
JAR=$SDK/platforms/android-34/android.jar
HERE=$(cd "$(dirname "$0")" && pwd); APP=$HERE/app/src/main; B=$HERE/build
rm -rf "$B"; mkdir -p "$B/res" "$B/gen" "$B/classes" "$B/dex" "$B/assets/harvest"
# game files → assets/harvest (offline copy of ../harvest; dev-only files stay out)
( cd "$HERE/../harvest" && tar cf - index.html style.css js vendor ) | ( cd "$B/assets/harvest" && tar xf - )
"$AAPT2" compile --dir "$APP/res" -o "$B/res/res.zip"
sed 's#<manifest xmlns:android="http://schemas.android.com/apk/res/android">#<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.zilo.banmuharvest">#' "$APP/AndroidManifest.xml" > "$B/AndroidManifest.xml"
"$AAPT2" link -I "$JAR" --manifest "$B/AndroidManifest.xml" -o "$B/base.apk" --java "$B/gen" -A "$B/assets" "$B/res/res.zip" --min-sdk-version 24 --target-sdk-version 34 --version-code 3 --version-name 3.0
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$JAR" -classpath "$JAR" -d "$B/classes" -Xlint:-options $(find "$APP/java" "$B/gen" -name '*.java')
java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 --release --min-api 24 --lib "$JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')
cp "$B/base.apk" "$B/unsigned.apk"; ( cd "$B/dex" && zip -q -j "$B/unsigned.apk" classes.dex )
"$ZIPALIGN" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"
KS=$HERE/debug.keystore
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storetype pkcs12 -storepass android -keypass android -alias androiddebugkey -dname "CN=Android Debug,O=Android,C=US" -keyalg RSA -keysize 2048 -validity 10000 >/dev/null
java -jar "$BT/lib/apksigner.jar" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey --out "$B/banmu-harvest-debug.apk" "$B/aligned.apk"
java -jar "$BT/lib/apksigner.jar" verify --print-certs "$B/banmu-harvest-debug.apk" | head -3
mkdir -p /workspace/work/out && cp "$B/banmu-harvest-debug.apk" /workspace/work/out/banmu-harvest-debug.apk
ls -la "$B/banmu-harvest-debug.apk"
