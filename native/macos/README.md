# macOS screen saver (`.saver`)

A `ScreenSaverView` hosting a `WKWebView`. Build with `./build.sh` (needs Xcode command-line
tools; no Xcode project). Output: `build/CosmicMeridian.saver` and a zip in `../../release/`.
The executable is linked as a Mach-O **bundle** (`clang -bundle` over swiftc objects) — System
Settings ignores `.saver` bundles whose executable is a dylib, which is all `swiftc -emit-library`
can produce. Assembly happens in a temp dir because Finder re-tags `.saver` folders inside
Documents with metadata that strict `codesign` verification rejects.

- **Source**: Online (the live site, always current) or Offline (the `dist-wallpaper` build bundled
  under `Resources/web`, made by `npm run build:wallpaper` first). Online falls back to Offline
  when the network fails.
- **Sound**: Web Audio is allowed to start without a click (`mediaTypesRequiringUserActionForPlayback = []`).
  Only the first non-preview instance (the main display) plays audio; other displays are visual-only.
- **Settings**: the Options… sheet stores source / sound / volume in `ScreenSaverDefaults`; the
  site's own ⚙ settings persist in the screen-saver process's web data store.
- **Install**: double-click the `.saver` → System Settings → Screen Saver. Unsigned/ad-hoc builds
  trigger Gatekeeper on first open: right-click → Open, or `xattr -d com.apple.quarantine CosmicMeridian.saver`.
- **Image relay (macOS 14+)**: third-party savers run inside the `legacyScreenSaver` host, where a
  `WKWebView`'s remotely composited layers come out black even though the page runs (sound plays).
  The view therefore snapshots the web view at ~24 fps into its own layer. Disable with
  `defaults -currentHost write com.3dqiflow.cosmic.saver relay -bool false` if a future macOS fixes it.
- **Audio rules**: only a view filling ≥ 60 % of a screen may play (System Settings' preview reports
  `isPreview == false`), only the first such instance does, and a watchdog tears the web view down
  two ticks after the view leaves its window or is hidden (the host does not always call `stopAnimation`).
  Emergency stop if a host ever keeps playing: `pkill -f legacyScreenSaver`.
- Logs: `log show --last 5m --predicate 'subsystem == "com.3dqiflow.cosmic.saver"'`.
