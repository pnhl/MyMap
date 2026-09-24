#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS with Xcode installed." >&2
  exit 1
fi

command -v xcodebuild >/dev/null 2>&1 || { echo "xcodebuild not found." >&2; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "zip not found." >&2; exit 1; }

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCHEME="${MYMAP_IOS_SCHEME:-MyMapFirebaseTests}"
WORKSPACE="${MYMAP_IOS_WORKSPACE:-$ROOT_DIR/ios/MyMap.xcworkspace}"
DERIVED_DATA="${MYMAP_IOS_DERIVED_DATA:-$ROOT_DIR/.firebase-xctest-derived}"
OUTPUT_ZIP="${MYMAP_IOS_TEST_ZIP:-$ROOT_DIR/dist/MyMap-Firebase-XCTest.zip}"
SIGNING_MODE="${MYMAP_IOS_SIGNING_MODE:-adhoc}"

if [[ ! -d "$WORKSPACE" ]]; then
  echo "Xcode workspace not found: $WORKSPACE" >&2
  exit 1
fi

rm -rf "$DERIVED_DATA"
mkdir -p "$(dirname "$OUTPUT_ZIP")"
rm -f "$OUTPUT_ZIP"

echo "== Xcode =="
xcodebuild -version

echo "== Schemes =="
xcodebuild -workspace "$WORKSPACE" -list

echo "== Build for testing =="
if [[ "$SIGNING_MODE" == "xcode" ]]; then
  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Debug \
    -derivedDataPath "$DERIVED_DATA" \
    -destination 'generic/platform=iOS' \
    -sdk iphoneos \
    build-for-testing
else
  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Debug \
    -derivedDataPath "$DERIVED_DATA" \
    -destination 'generic/platform=iOS' \
    -sdk iphoneos \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    build-for-testing
fi

PRODUCTS_DIR="$DERIVED_DATA/Build/Products"
DEVICE_PRODUCTS="$PRODUCTS_DIR/Debug-iphoneos"

if [[ ! -d "$DEVICE_PRODUCTS" ]]; then
  echo "Missing physical-device build output: $DEVICE_PRODUCTS" >&2
  find "$PRODUCTS_DIR" -maxdepth 2 -print 2>/dev/null || true
  exit 1
fi

XCTESTRUN_FILE=""
XCTESTRUN_COUNT=0
while IFS= read -r file; do
  XCTESTRUN_FILE="$file"
  XCTESTRUN_COUNT=$((XCTESTRUN_COUNT + 1))
done < <(find "$PRODUCTS_DIR" -maxdepth 1 -type f -name '*.xctestrun' -print)

if [[ "$XCTESTRUN_COUNT" -ne 1 ]]; then
  echo "Expected exactly one .xctestrun in $PRODUCTS_DIR; found $XCTESTRUN_COUNT." >&2
  find "$PRODUCTS_DIR" -maxdepth 1 -type f -name '*.xctestrun' -print >&2 || true
  exit 1
fi

# CI-friendly signature. Firebase Test Lab re-signs uploaded apps. If you want
# Apple Developer signing instead, set MYMAP_IOS_SIGNING_MODE=xcode and provide
# the certificate/profile to the runner before this script runs.
if [[ "$SIGNING_MODE" == "adhoc" ]]; then
  echo "== Ad-hoc signing build products =="
  while IFS= read -r bundle; do
    echo "Signing: $bundle"
    /usr/bin/codesign --force --deep --sign - "$bundle"
  done < <(
    find "$DEVICE_PRODUCTS" -type d \( -name '*.framework' -o -name '*.xctest' -o -name '*.app' \) -print \
      | awk '{ print length($0), $0 }' \
      | sort -rn \
      | cut -d' ' -f2-
  )
fi

if [[ "$SIGNING_MODE" != "none" ]]; then
  echo "== Verify app signatures =="
  while IFS= read -r app; do
    echo "Verifying: $app"
    /usr/bin/codesign --verify --deep --verbose=2 "$app"
  done < <(find "$DEVICE_PRODUCTS" -type d -name '*.app' -print)
fi

echo "== Package Firebase XCTest =="
(
  cd "$PRODUCTS_DIR"
  zip -qry "$OUTPUT_ZIP" \
    "Debug-iphoneos" \
    "$(basename "$XCTESTRUN_FILE")"
)

echo "== Validate ZIP =="
TMP_LIST="$(mktemp)"
unzip -Z1 "$OUTPUT_ZIP" > "$TMP_LIST"
ZIP_XCTESTRUN_COUNT="$(grep -Ec '^[^/]+\.xctestrun$' "$TMP_LIST" || true)"
if [[ "$ZIP_XCTESTRUN_COUNT" -ne 1 ]]; then
  echo "Invalid ZIP: expected one top-level .xctestrun; found $ZIP_XCTESTRUN_COUNT" >&2
  cat "$TMP_LIST" >&2
  rm -f "$TMP_LIST"
  exit 1
fi
if ! grep -q '^Debug-iphoneos/' "$TMP_LIST"; then
  echo "Invalid ZIP: Debug-iphoneos/ is missing" >&2
  rm -f "$TMP_LIST"
  exit 1
fi
rm -f "$TMP_LIST"

shasum -a 256 "$OUTPUT_ZIP" | tee "$OUTPUT_ZIP.sha256"

echo
printf 'Firebase Test Lab package created:\n  %s\n' "$OUTPUT_ZIP"
printf 'XCTestRun:\n  %s\n' "$XCTESTRUN_FILE"
