#!/bin/bash
# Publishes a GitHub Release with the files from dist/ (update.json, web-<ver>.json, ChickenKhata-<ver>.apk).
# Every phone's built-in updater reads: https://github.com/<repo>/releases/latest/download/update.json
set -euo pipefail
cd "$(dirname "$0")"
REPO="${UPDATE_REPO:-rs0404/chicken-khata-updates}"
[ -f dist/update.json ] || { echo "Run ./build.sh first"; exit 1; }
source ./version.env
TAG="v$WEB_VERSION"
NOTES="Screens v$WEB_VERSION · App (APK) v$APK_NAME (code $APK_CODE)${APK_NOTES:+ — $APK_NOTES}"
if gh release view "$TAG" -R "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" dist/* -R "$REPO" --clobber
else
  gh release create "$TAG" dist/* -R "$REPO" --title "Chicken Khata $WEB_VERSION" --notes "$NOTES" --latest
fi
echo "Released $TAG: https://github.com/$REPO/releases/tag/$TAG"
