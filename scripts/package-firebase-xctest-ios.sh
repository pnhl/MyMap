#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS with Xcode installed." >&2
  exit 1
fi

command -v xcodebuild >/dev/null 2>&1 || {
  echo "xcodebuild was not found. Install Xcode and select it with xcode-select." >&2
  exit 1
}
command -v zip >/dev/null 2>&1 || {
  echo "zip was not found." >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCHEME="${MYMAP_IOS_SCHEME:-MyMap}"
WORKSPACE="${MYMAP_IOS_WORKSPACE:-$ROOT_DIR/ios/MyMap.xcworkspace}"
DERIVED_DATA="${MYMAP_IOS_DERIVED_DATA:-$ROOT_DIR/.firebase-xctest-derived}"
OUTPUT_ZIP="${MYMAP_IOS_TEST_ZIP:-$ROOT_DIR/dist/MyMap-Firebase-XCTest.zip}"

if [[ ! -d "$WORKSPACE" ]]; then
  echo "Xcode workspace not found: $WORKSPACE" >&2
  echo "Run npm ci, npx expo prebuild --platform ios, and pod install first." >&2
  exit 1
fi

xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -derivedDataPath "$DERIVED_DATA" \
  -sdk iphoneos \
  build-for-testing

PRODUCTS_DIR="$DERIVED_DATA/Build/Products"
DEVICE_PRODUCTS="$PRODUCTS_DIR/Debug-iphoneos"

if [[ ! -d "$DEVICE_PRODUCTS" ]]; then
  echo "Missing physical-device build output: $DEVICE_PRODUCTS" >&2
  exit 1
fi

XCTESTRUN_FILES=()
while IFS= read -r -d '' xctestrun; do
  XCTESTRUN_FILES+=("$xctestrun")
done < <(find "$PRODUCTS_DIR" -maxdepth 1 -type f -name '*.xctestrun' -print0)
if [[ ${#XCTESTRUN_FILES[@]} -ne 1 ]]; then
  echo "Expected exactly one .xctestrun file in $PRODUCTS_DIR; found ${#XCTESTRUN_FILES[@]}." >&2
  printf '  %s\n' "${XCTESTRUN_FILES[@]:-none}" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_ZIP")"
rm -f "$OUTPUT_ZIP"

(
  cd "$PRODUCTS_DIR"
  zip -r "$OUTPUT_ZIP" \
    "Debug-iphoneos" \
    "$(basename "${XCTESTRUN_FILES[0]}")"
)

shasum -a 256 "$OUTPUT_ZIP" > "$OUTPUT_ZIP.sha256"
echo "Firebase Test Lab XCTest package created: $OUTPUT_ZIP"
