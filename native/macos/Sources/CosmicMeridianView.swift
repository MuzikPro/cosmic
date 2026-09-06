//  天人 · Cosmic Meridian — macOS screen saver (owner 2026-09-05).
//  A ScreenSaverView hosting a WKWebView. Source: the live site (default) or the offline build
//  bundled in Resources/web. Sound rules (owner 2026-09-05, after the "can't stop the sound" bug):
//    • only a view that fills (≥ 60 % of) a screen may play audio — System Settings hosts the
//      saver for its preview tile with isPreview == false since Sonoma, so isPreview alone is not
//      enough; the tile is small, the real saver is full-screen;
//    • only the first such instance (main display) plays; other displays are visual-only;
//    • a watchdog tears the web view down as soon as the view leaves its window or is hidden,
//      because the legacy host does not reliably call stopAnimation for previews.
//  Settings the site itself keeps (localStorage) persist in the host process's web data store.
import ScreenSaver
import WebKit

@objc(CosmicMeridianView)
public final class CosmicMeridianView: ScreenSaverView, WKNavigationDelegate {
    private static var audioOwnerAssigned = false
    private static let liveURL = "https://cosmic.3dqiflow.com/"
    private var webView: WKWebView?
    private var playsAudio = false
    private var triedOffline = false
    private var watchdog: Timer?
    private lazy var defaults: ScreenSaverDefaults = {
        let d = ScreenSaverDefaults(forModuleWithName: Bundle(for: CosmicMeridianView.self).bundleIdentifier ?? "com.3dqiflow.cosmic.saver")!
        d.register(defaults: ["source": "online", "sound": true, "volume": 20])
        return d
    }()
    private lazy var sheet: NSWindow = makeSheet()
    private var sourcePopup: NSPopUpButton!
    private var soundCheck: NSButton!
    private var volumeSlider: NSSlider!

    public override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0
        wantsLayer = true
        layer?.backgroundColor = NSColor(red: 0.06, green: 0.06, blue: 0.10, alpha: 1).cgColor
        // audio ownership is decided in startAnimation, once the view's real size and screen are known
    }
    deinit { teardown() }

    /** 真正的屏保视图铺满一块屏幕；System Settings 的预览格子很小（且 isPreview 可能为 false） */
    private var fillsAScreen: Bool {
        guard !isPreview, let screen = window?.screen ?? NSScreen.main else { return false }
        let f = window?.frame ?? frame
        return f.width >= screen.frame.width * 0.6 && f.height >= screen.frame.height * 0.6
    }
    required init?(coder: NSCoder) { super.init(coder: coder) }

    public override func startAnimation() {
        super.startAnimation()
        if !playsAudio && fillsAScreen && !CosmicMeridianView.audioOwnerAssigned {
            CosmicMeridianView.audioOwnerAssigned = true
            playsAudio = true
        }
        if webView == nil { buildWebView() }
        startWatchdog()
    }
    public override func stopAnimation() {
        super.stopAnimation()
        teardown()
    }
    public override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window == nil { teardown() }
    }
    public override func viewDidHide() { super.viewDidHide(); teardown() }
    /** 每 2 s 检查一次：离开窗口、被隐藏、窗口不可见 → 立即拆除（停声、释放 WebGL） */
    private func startWatchdog() {
        watchdog?.invalidate()
        watchdog = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if self.window == nil || self.isHiddenOrHasHiddenAncestor || self.window?.isVisible == false || self.window?.occlusionState.contains(.visible) == false {
                self.teardown()
            }
        }
    }
    public override func animateOneFrame() { /* WKWebView renders itself */ }
    public override func draw(_ rect: NSRect) {
        NSColor(red: 0.06, green: 0.06, blue: 0.10, alpha: 1).setFill()
        rect.fill()
    }

    // MARK: web view
    private func buildWebView() {
        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []      // Web Audio may start without a click
        cfg.allowsAirPlayForMediaPlayback = false
        cfg.suppressesIncrementalRendering = true
        let wv = WKWebView(frame: bounds, configuration: cfg)
        wv.autoresizingMask = [.width, .height]
        wv.navigationDelegate = self
        wv.setValue(false, forKey: "drawsBackground")
        addSubview(wv)
        webView = wv
        load(into: wv, offline: defaults.string(forKey: "source") == "offline")
    }
    private func query() -> String {
        let sound = defaults.bool(forKey: "sound") && playsAudio
        let volume = max(0, min(70, defaults.integer(forKey: "volume")))
        var q = "saver=1&sound=\(sound ? 1 : 0)&autoplay=\(sound ? 1 : 0)&volume=\(volume)"
        if isPreview { q += "&saverpreview=1" }
        return q
    }
    private func offlineIndex() -> URL? {
        Bundle(for: CosmicMeridianView.self).url(forResource: "index", withExtension: "html", subdirectory: "web")
    }
    private func load(into wv: WKWebView, offline: Bool) {
        if offline, let index = offlineIndex() {
            triedOffline = true
            var comps = URLComponents(url: index, resolvingAgainstBaseURL: false)!
            comps.query = query()
            wv.loadFileURL(comps.url ?? index, allowingReadAccessTo: index.deletingLastPathComponent())
        } else {
            wv.load(URLRequest(url: URL(string: CosmicMeridianView.liveURL + "?" + query())!, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 20))
        }
    }
    // Offline fallback when the network is unavailable
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fallback() }
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fallback() }
    private func fallback() {
        guard let wv = webView, !triedOffline, offlineIndex() != nil else { return }
        load(into: wv, offline: true)
    }
    private func teardown() {
        watchdog?.invalidate(); watchdog = nil
        if playsAudio { CosmicMeridianView.audioOwnerAssigned = false; playsAudio = false }
        guard let wv = webView else { return }
        wv.stopLoading()
        wv.loadHTMLString("", baseURL: nil)     // stops audio and frees the WebGL context
        wv.navigationDelegate = nil
        wv.removeFromSuperview()
        webView = nil
        triedOffline = false
    }

    // MARK: configure sheet
    public override var hasConfigureSheet: Bool { true }
    public override var configureSheet: NSWindow? {
        let window = sheet          // 先建好面板（懒加载），控件才存在
        sourcePopup.selectItem(at: defaults.string(forKey: "source") == "offline" ? 1 : 0)
        soundCheck.state = defaults.bool(forKey: "sound") ? .on : .off
        volumeSlider.integerValue = defaults.integer(forKey: "volume")
        return window
    }
    private func makeSheet() -> NSWindow {
        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 420, height: 230), styleMask: [.titled], backing: .buffered, defer: false)
        w.title = "Cosmic Meridian"
        let v = NSView(frame: w.contentRect(forFrameRect: w.frame))
        func label(_ s: String, _ y: CGFloat) { let l = NSTextField(labelWithString: s); l.frame = NSRect(x: 20, y: y, width: 120, height: 20); v.addSubview(l) }
        label("Source", 180)
        sourcePopup = NSPopUpButton(frame: NSRect(x: 140, y: 176, width: 260, height: 26), pullsDown: false)
        sourcePopup.addItems(withTitles: ["Online — cosmic.3dqiflow.com (always current)", "Offline — bundled build"])
        v.addSubview(sourcePopup)
        label("Sound", 140)
        soundCheck = NSButton(checkboxWithTitle: "Time & Sound soundscape (main display only)", target: nil, action: nil)
        soundCheck.frame = NSRect(x: 140, y: 138, width: 270, height: 22)
        v.addSubview(soundCheck)
        label("Volume", 100)
        volumeSlider = NSSlider(value: 20, minValue: 0, maxValue: 70, target: nil, action: nil)
        volumeSlider.frame = NSRect(x: 140, y: 98, width: 260, height: 22)
        v.addSubview(volumeSlider)
        let note = NSTextField(wrappingLabelWithString: "Educational and decorative only — not medical advice. Engine open source (MIT), sound design proprietary, body mesh CC BY 4.0 (NIH 3D).")
        note.frame = NSRect(x: 20, y: 48, width: 380, height: 40); note.font = NSFont.systemFont(ofSize: 10); note.textColor = .secondaryLabelColor
        v.addSubview(note)
        let ok = NSButton(title: "OK", target: self, action: #selector(saveAndClose)); ok.frame = NSRect(x: 320, y: 12, width: 80, height: 28); ok.keyEquivalent = "\r"
        let cancel = NSButton(title: "Cancel", target: self, action: #selector(closeSheet)); cancel.frame = NSRect(x: 230, y: 12, width: 80, height: 28); cancel.keyEquivalent = "\u{1b}"
        v.addSubview(ok); v.addSubview(cancel)
        w.contentView = v
        return w
    }
    @objc private func saveAndClose() {
        defaults.set(sourcePopup.indexOfSelectedItem == 1 ? "offline" : "online", forKey: "source")
        defaults.set(soundCheck.state == .on, forKey: "sound")
        defaults.set(volumeSlider.integerValue, forKey: "volume")
        defaults.synchronize()
        closeSheet()
    }
    @objc private func closeSheet() {
        if let parent = sheet.sheetParent { parent.endSheet(sheet) } else { sheet.orderOut(nil) }
    }
}
