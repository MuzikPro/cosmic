# macOS screen saver (`.saver`)

A `ScreenSaverView` hosting a `WKWebView`. Build with `./build.sh` (needs Xcode command-line
tools; no Xcode project). Output: `build/CosmicMeridian.saver` and a zip in `../../release/`.

- **Source**: Online (the live site, always current) or Offline (the `dist-wallpaper` build bundled
  under `Resources/web`, made by `npm run build:wallpaper` first). Online falls back to Offline
  when the network fails.
- **Sound**: Web Audio is allowed to start without a click (`mediaTypesRequiringUserActionForPlayback = []`).
  Only the first non-preview instance (the main display) plays audio; other displays are visual-only.
- **Settings**: the Options… sheet stores source / sound / volume in `ScreenSaverDefaults`; the
  site's own ⚙ settings persist in the screen-saver process's web data store.
- **Install**: double-click the `.saver` → System Settings → Screen Saver. Unsigned/ad-hoc builds
  trigger Gatekeeper on first open: right-click → Open, or `xattr -d com.apple.quarantine CosmicMeridian.saver`.
- **Known macOS behaviour**: since macOS 14 third-party savers run in `legacyScreenSaver`; the
  small preview in System Settings may stay dark for WebGL content while the real saver works.
  Press a key to exit; the web page's UI chips are hidden anyway.
