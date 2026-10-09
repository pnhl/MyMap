#!/usr/bin/env bash
set -euo pipefail
[[ "$(uname)" == Darwin ]] || { echo 'iOS archive requires macOS and Xcode.'; exit 1; }
export MYMAP_STORE=ios MYMAP_RELEASE=true EXPO_PUBLIC_ENABLE_TEST_ADS=false RNLLAMA_SKIP_POSTINSTALL=1
node scripts/release-check.cjs
node scripts/prepare-ios-ai.cjs
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
workspace=$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)
scheme=$(node -p "require('./app.json').expo.name")
mkdir -p dist/releases/unsigned/Payload
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath .local/ios-derived CODE_SIGNING_ALLOWED=NO ENABLE_DEBUG_DYLIB=NO build
app=$(find .local/ios-derived/Build/Products/Release-iphoneos -maxdepth 1 -name '*.app' -print -quit)
[[ -n "$app" ]] || { echo 'No iOS app produced.'; exit 1; }
cp -R "$app" dist/releases/unsigned/Payload/
(cd dist/releases/unsigned && zip -qr ../MyMap-ios-unsigned.ipa Payload)
python3 scripts/verify-artifacts.py --ios dist/releases/MyMap-ios-unsigned.ipa --unsigned
