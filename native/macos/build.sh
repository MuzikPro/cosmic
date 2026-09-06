#!/bin/sh
# Build 天人 · Cosmic Meridian.saver (universal arm64 + x86_64) without an Xcode project.
#   ./build.sh            → build/CosmicMeridian.saver (+ zip in ../../release/)
#   CODESIGN_IDENTITY="Developer ID Application: …" ./build.sh   → sign for distribution (default: ad-hoc)
# The offline build (../../dist-wallpaper, from `npm run build:wallpaper`) is bundled into Resources/web when present.
set -e
cd "$(dirname "$0")"
NAME=CosmicMeridian
# Assemble in a temp dir outside Documents/iCloud: Finder re-tags .saver folders there with FinderInfo,
# which strict codesign verification rejects as "detritus". The finished bundle is copied to build/.
SRC="$(pwd)"
OUT="$(mktemp -d /tmp/cosmic-saver.XXXXXX)"
rm -rf build; mkdir -p build
# Screen savers must be Mach-O *bundles* (like Apple's own), not dylibs — System Settings skips dylib
# executables. swiftc can only emit dylibs, so compile to objects and link with clang -bundle; the Swift
# runtime libraries are pulled in through the objects' autolink entries (toolchain path for the
# static compatibility libs, SDK path for the system stubs).
SDK="$(xcrun --sdk macosx --show-sdk-path)"
TOOLCHAIN_SWIFT="$(dirname "$(xcrun -f swiftc)")/../lib/swift/macosx"
for ARCH in arm64 x86_64; do
  swiftc -c -O -swift-version 5 -target "$ARCH-apple-macos12.0" -parse-as-library -module-name "$NAME" \
    -o "$OUT/$NAME-$ARCH.o" "$SRC"/Sources/*.swift
  clang -bundle -target "$ARCH-apple-macos12.0" -isysroot "$SDK" -o "$OUT/$NAME-$ARCH" "$OUT/$NAME-$ARCH.o" \
    -framework ScreenSaver -framework WebKit -framework AppKit \
    -L"$TOOLCHAIN_SWIFT" -L"$SDK/usr/lib/swift" -L/usr/lib/swift -Xlinker -rpath -Xlinker /usr/lib/swift
done
lipo -create -output "$OUT/$NAME" "$OUT/$NAME-arm64" "$OUT/$NAME-x86_64"
B="$OUT/$NAME.saver/Contents"
mkdir -p "$B/MacOS" "$B/Resources"
cp "$SRC/Info.plist" "$B/Info.plist"
cp "$OUT/$NAME" "$B/MacOS/$NAME"
if [ -d "$SRC/../../dist-wallpaper" ]; then
  cp -R "$SRC/../../dist-wallpaper" "$B/Resources/web"
  rm -f "$B/Resources/web/project.json" "$B/Resources/web/LivelyInfo.json" "$B/Resources/web/LivelyProperties.json" "$B/Resources/web/README.txt"
  echo "bundled offline build into Resources/web"
fi
# Finder/quarantine xattrs on copied web assets make codesign refuse the bundle; macOS also re-tags
# the .saver folder with FinderInfo, so clear again right before signing and verify immediately.
xattr -cr "$OUT/$NAME.saver"
codesign --force --deep --sign "${CODESIGN_IDENTITY:--}" "$OUT/$NAME.saver"
xattr -cr "$OUT/$NAME.saver"
codesign --verify --deep --strict "$OUT/$NAME.saver" && echo "codesign verify ok"
mkdir -p "$SRC/../../release"
VER=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$SRC/Info.plist")
ZIP="$SRC/../../release/CosmicMeridian-macOS-$VER.saver.zip"
rm -f "$ZIP"; (cd "$OUT" && zip -qryX "$ZIP" "$NAME.saver")
# verify what users will actually get: unzip to a fresh temp dir and check the signature there
CHK="$(mktemp -d /tmp/cosmic-saver-check.XXXXXX)"; (cd "$CHK" && unzip -q "$ZIP" && codesign --verify --deep --strict "$NAME.saver" && echo "zip contents verify ok")
cp -R "$OUT/$NAME.saver" "$SRC/build/$NAME.saver"
rm -rf "$OUT" "$CHK"
echo "built build/$NAME.saver → release/CosmicMeridian-macOS-$VER.saver.zip"
