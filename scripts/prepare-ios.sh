#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != Darwin ]; then
  echo 'Cần macOS và Xcode để chuẩn bị và kiểm thử dự án iOS.' >&2
  exit 1
fi
command -v node >/dev/null
command -v npx >/dev/null
command -v pod >/dev/null || { echo 'Cài CocoaPods trên máy Mac trước khi chạy.' >&2; exit 1; }
if [ ! -f GoogleService-Info.plist ]; then
  echo 'Cần GoogleService-Info.plist của ứng dụng iOS trong Firebase MyMap, đặt ở thư mục gốc dự án.' >&2
  exit 1
fi
npm ci --ignore-scripts
npx expo prebuild --platform ios --no-install
cd ios
pod install
echo 'Đã chuẩn bị workspace. Mở file .xcworkspace trong Xcode để kiểm tra Simulator và thiết bị.'
