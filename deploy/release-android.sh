#!/usr/bin/env bash
# NOT WIRED UP AT THE MOMENT: the site promotes the home-screen (PWA) install
# instead, and nginx no longer serves /downloads. Kept for when the APK returns.
# Publish the latest finished Android build to the site's /downloads so the
# "Get the app" card hands people a stable link. Run from the repo root after
# `npx eas-cli@latest build --platform android --profile preview` finishes:
#
#   bash deploy/release-android.sh            # latest finished preview build
#   bash deploy/release-android.sh <build-id> # a specific build
#
# Writes deploy/downloads/snapclaim.apk and deploy/downloads/latest.json, which
# the running snapclaim-web container serves straight away (bind mount).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p deploy/downloads

if [ "${1:-}" != "" ]; then
  json=$(cd app && npx eas-cli@latest build:view "$1" --json 2>/dev/null)
else
  json=$(cd app && npx eas-cli@latest build:list --platform android --build-profile preview --status finished --limit 1 --json --non-interactive 2>/dev/null)
  json=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify(Array.isArray(j)?j[0]:j))})' <<<"$json")
fi

url=$(node -e 'const j=JSON.parse(process.argv[1]);console.log(j.artifacts.buildUrl)' "$json")
version=$(node -e 'const j=JSON.parse(process.argv[1]);console.log(j.appVersion)' "$json")
build=$(node -e 'const j=JSON.parse(process.argv[1]);console.log(j.appBuildVersion)' "$json")
id=$(node -e 'const j=JSON.parse(process.argv[1]);console.log(j.id)' "$json")

echo "Fetching build $id (v$version, build $build)"
curl -fL --progress-bar -o deploy/downloads/snapclaim.apk.part "$url"
mv deploy/downloads/snapclaim.apk.part deploy/downloads/snapclaim.apk
size=$(stat -c %s deploy/downloads/snapclaim.apk 2>/dev/null || stat -f %z deploy/downloads/snapclaim.apk)
cat > deploy/downloads/latest.json <<EOF
{ "platform": "android", "version": "$version", "build": $build, "build_id": "$id", "size": $size, "released_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)", "path": "/downloads/snapclaim.apk" }
EOF
echo "Published deploy/downloads/snapclaim.apk ($((size / 1024 / 1024)) MB) and latest.json"
