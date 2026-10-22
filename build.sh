#!/bin/bash
# Builds GramHisab.apk without Gradle, using the Android SDK command line tools.
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-35/android.jar"
OUT=build
source ./version.env
# one version number everywhere
sed -i '' "s/const APP_VERSION = '[^']*'/const APP_VERSION = '$WEB_VERSION'/" assets/core.js
printf '%s' "$WEB_VERSION" > assets/version.txt
sed -i '' -E "s/android:versionCode=\"[0-9]+\"/android:versionCode=\"$APK_CODE\"/; s/android:versionName=\"[^\"]+\"/android:versionName=\"$APK_NAME\"/" AndroidManifest.xml
rm -rf "$OUT"; mkdir -p "$OUT/res" "$OUT/classes" "$OUT/dex"

"$BT/aapt2" compile --dir res -o "$OUT/res/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$JAR" --manifest AndroidManifest.xml \
  -A assets "$OUT/res/res.zip" --auto-add-overlay

javac --release 11 -classpath "$JAR" -nowarn \
  -d "$OUT/classes" $(find src -name '*.java')
"$BT/d8" --lib "$JAR" --min-api 24 --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# Keep this keystore safe: every future update must be signed with it,
# otherwise phones will refuse to install the update over the old version.
# The keystore and its password stay on this computer only (signing/ is not in git).
KS=signing/chickenkhata.keystore
mkdir -p signing
[ -f signing/keystore.pass ] || { head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' > signing/keystore.pass; }
KS_PASS=$(cat signing/keystore.pass)
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias chickenkhata -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Gram Hisab, O=Farm, C=NP"
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out GramHisab.apk "$OUT/aligned.apk"
"$BT/apksigner" verify GramHisab.apk
echo "Built: $(pwd)/GramHisab.apk ($(du -h GramHisab.apk | cut -f1))"

# update files for the built-in updater (publish with ./publish.sh)
rm -rf dist; mkdir -p dist
cp GramHisab.apk "dist/GramHisab-$APK_NAME.apk"
python3 - "$WEB_VERSION" "$MIN_NATIVE" "$APK_CODE" "$APK_NAME" "$APK_NOTES" <<'PY'
import json, os, sys
web, min_native, code, name, notes = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
files = {f: open(os.path.join('assets', f), encoding='utf-8').read() for f in sorted(os.listdir('assets')) if not f.startswith('.')}
json.dump({'version': web, 'files': files}, open(f'dist/web-{web}.json', 'w', encoding='utf-8'), ensure_ascii=False)
json.dump({'web': {'version': web, 'minNative': min_native, 'bundle': f'web-{web}.json'},
           'apk': {'versionCode': code, 'versionName': name, 'file': f'GramHisab-{name}.apk', 'notes': notes}},
          open('dist/update.json', 'w'), indent=2)
print('Update files:', ', '.join(sorted(os.listdir('dist'))))
PY
