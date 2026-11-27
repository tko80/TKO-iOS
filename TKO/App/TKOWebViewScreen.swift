
import SwiftUI
import WebKit
import UniformTypeIdentifiers
import AVFoundation
import UIKit

struct TKOWebViewScreen: UIViewControllerRepresentable {

    func makeUIViewController(context: Context) -> TKOWebViewController {
        TKOWebViewController()
    }

    func updateUIViewController(
        _ uiViewController: TKOWebViewController,
        context: Context
    ) {}
}

final class TKOWebViewController: UIViewController,
    WKNavigationDelegate,
    WKScriptMessageHandler,
    UIDocumentPickerDelegate {

    private var webView: WKWebView!
    private let speech = AVSpeechSynthesizer()
    private var pendingRestore = false
    private var hasShownLoadError = false
    private let deliveryStore = DeliveryStore()

    override func viewDidLoad() {
        super.viewDidLoad()

        // Match the app's dark sky background if WebView ever exposes an edge.
        let tkoBackground = UIColor(red: 8.0/255.0, green: 24.0/255.0, blue: 55.0/255.0, alpha: 1.0)
        view.backgroundColor = tkoBackground

        setupWebView()
        loadLocalApp()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(flushWebStorageBeforeBackground),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func flushWebStorageBeforeBackground() {
        guard webView != nil else { return }
        let script = """
        (function(){
          var values={};
          try { for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k!==null)values[k]=localStorage.getItem(k);} }
          catch(e) { return null; }
          return values;
        })();
        """
        webView.evaluateJavaScript(script) { [weak self] result, error in
            guard error == nil, let values = result as? [String: String] else { return }
            self?.persistWebStorage(["action": "snapshot", "data": values])
        }
    }

    // MARK: - WebView Setup

    private func setupWebView() {

        let contentController = WKUserContentController()

        contentController.add(self, name: "tkoBackup")
        contentController.add(self, name: "tkoStorage")
        contentController.add(self, name: "tkoTTS")
        contentController.add(self, name: "tkoShare")
        contentController.add(self, name: "tkoDeliveryNote")
        contentController.add(self, name: "tkoAunglan")

        let storageBootstrap = WKUserScript(
            source: storageBootstrapScript(),
            injectionTime: .atDocumentStart,
            // Apply to the main page and the Cargo Records srcdoc iframe too.
            // Cargo saves in its own JavaScript frame and must reach native storage.
            forMainFrameOnly: false
        )
        contentController.addUserScript(storageBootstrap)

        let bridge = WKUserScript(
            source: Self.bridgeScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        contentController.addUserScript(bridge)

        let configuration = WKWebViewConfiguration()

        configuration.userContentController = contentController
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        webView = WKWebView(
            frame: .zero,
            configuration: configuration
        )

        webView.navigationDelegate = self

        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 8.0/255.0, green: 24.0/255.0, blue: 55.0/255.0, alpha: 1.0)
        webView.scrollView.backgroundColor = UIColor(red: 8.0/255.0, green: 24.0/255.0, blue: 55.0/255.0, alpha: 1.0)

        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.alwaysBounceVertical = true
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.bounces = false
        webView.scrollView.isDirectionalLockEnabled = true
        webView.scrollView.showsHorizontalScrollIndicator = false
        webView.scrollView.keyboardDismissMode = .interactive

        view.addSubview(webView)

        webView.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }

    // MARK: - Load Original HTML

    private func loadLocalApp() {

        guard let resourceURL = Bundle.main.resourceURL else {
            showLoadError("App resource directory not found.")
            return
        }

        // Search index.html recursively inside the app bundle.

        guard let enumerator = FileManager.default.enumerator(
            at: resourceURL,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            showLoadError("Cannot access app resources.")
            return
        }

        var indexURL: URL?

        for case let fileURL as URL in enumerator {

            if fileURL.lastPathComponent.lowercased() == "index.html" {
                indexURL = fileURL
                break
            }
        }

        guard let htmlURL = indexURL else {
            showLoadError(
                "index.html was not found.\n\nPlease check TKO/WebApp resources in project.yml."
            )
            return
        }

        // Allow access to all local HTML, CSS, JS and image files.

        let accessDirectory = resourceURL

        webView.loadFileURL(
            htmlURL,
            allowingReadAccessTo: accessDirectory
        )
    }

    // MARK: - Navigation Delegate

    func webView(
        _ webView: WKWebView,
        didFinish navigation: WKNavigation!
    ) {

        print("TKO HTML loaded successfully")

        webView.evaluateJavaScript(
            "document.readyState"
        ) { result, error in

            if let error = error {
                print("JavaScript check error:", error)
            } else {
                print("HTML state:", result ?? "unknown")
            }
        }
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        print("TKO loading failed:", error.localizedDescription)

        showLoadError(error.localizedDescription)
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        print("TKO navigation error:", error.localizedDescription)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        print("WebKit process terminated. Reloading TKO.")
        loadLocalApp()
    }

    private func showLoadError(_ message: String) {

        guard !hasShownLoadError else { return }

        hasShownLoadError = true

        DispatchQueue.main.async {

            let alert = UIAlertController(
                title: "TKO Loading Error",
                message: message,
                preferredStyle: .alert
            )

            alert.addAction(
                UIAlertAction(title: "Retry", style: .default) {
                    [weak self] _ in

                    self?.hasShownLoadError = false
                    self?.loadLocalApp()
                }
            )

            alert.addAction(
                UIAlertAction(title: "OK", style: .cancel)
            )

            self.present(alert, animated: true)
        }
    }

    // MARK: - JavaScript Bridge

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {

        guard let body = message.body as? [String: Any] else {
            return
        }

        switch message.name {

        case "tkoBackup":
            handleBackup(body)

        case "tkoStorage":
            persistWebStorage(body)

        case "tkoTTS":
            let text = body["text"] as? String ?? ""
            speak(text)

        case "tkoShare":
            handleShare(body)

        case "tkoDeliveryNote":
            presentDeliveryNote()

        case "tkoAunglan":
            presentAunglan()

        default:
            break
        }
    }

    // MARK: - Delivery Note

    private func presentDeliveryNote() {
        guard presentedViewController == nil else { return }
        let deliveryView = RootView(onClose: { [weak self] in
            self?.dismiss(animated: true)
        })
        .environmentObject(deliveryStore)
        .preferredColorScheme(.light)

        let hosting = UIHostingController(rootView: deliveryView)
        hosting.modalPresentationStyle = .fullScreen
        present(hosting, animated: true)
    }

    // MARK: - Aunglan

    private func presentAunglan() {
        guard presentedViewController == nil else { return }
        let screen = TKOAunglanScreen(onClose: { [weak self] in
            self?.dismiss(animated: true)
        })
        let hosting = UIHostingController(rootView: screen)
        hosting.modalPresentationStyle = .fullScreen
        present(hosting, animated: true)
    }

    // MARK: - Durable Web Storage

    private let webStoragePrefix = "TKO.WebStorage."

    /// File-backed mirror is more reliable for larger Cargo/TKO localStorage values
    /// than relying on WebKit's file-URL storage database alone.
    private var webStorageFileURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let directory = base.appendingPathComponent("TKO", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("WebStorage.json")
    }

    private func loadDurableWebStorage() -> [String: String] {
        if let data = try? Data(contentsOf: webStorageFileURL),
           let values = try? JSONDecoder().decode([String: String].self, from: data) {
            return values
        }
        // One-time compatibility migration from the previous UserDefaults mirror.
        return UserDefaults.standard.dictionaryRepresentation().reduce(into: [String: String]()) { result, item in
            guard item.key.hasPrefix(webStoragePrefix), let value = item.value as? String else { return }
            result[String(item.key.dropFirst(webStoragePrefix.count))] = value
        }
    }

    private func writeDurableWebStorage(_ values: [String: String]) {
        do {
            let data = try JSONEncoder().encode(values)
            try data.write(to: webStorageFileURL, options: .atomic)
            // Keep the legacy mirror in sync for compatibility with earlier builds.
            let defaults = UserDefaults.standard
            let existing = defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(webStoragePrefix) }
            existing.forEach { defaults.removeObject(forKey: $0) }
            values.forEach { defaults.set($0.value, forKey: webStoragePrefix + $0.key) }
            defaults.synchronize()
        } catch {
            print("TKO durable storage write failed:", error.localizedDescription)
        }
    }

    private func storageBootstrapScript() -> String {
        let snapshot = loadDurableWebStorage()
        let data = (try? JSONSerialization.data(withJSONObject: snapshot, options: [.fragmentsAllowed])) ?? Data("{}".utf8)
        let json = (String(data: data, encoding: .utf8) ?? "{}").replacingOccurrences(of: "</", with: "<\\/")
        return """
        (function(){
          try {
            var nativeSnapshot = \(json);
            var storage = window.localStorage;
            Object.keys(nativeSnapshot).forEach(function(k){
              try { storage.setItem(k, nativeSnapshot[k]); } catch(e) { console.warn('TKO storage restore key failed:', k, e); }
            });
            // Migrate existing WebKit localStorage keys not yet in the native mirror.
            var migrated = {};
            for (var i=0; i<storage.length; i++) {
              var key=storage.key(i);
              if (key !== null) {
                var value=storage.getItem(key);
                if (!Object.prototype.hasOwnProperty.call(nativeSnapshot,key)) migrated[key]=value;
              }
            }
            if (Object.keys(migrated).length) {
              try { window.webkit.messageHandlers.tkoStorage.postMessage({action:'merge',data:migrated}); } catch(e) {}
            }
            var proto=Storage.prototype;
            if (proto.__tkoDurableWrapped) return;
            var originalSet=proto.setItem, originalRemove=proto.removeItem, originalClear=proto.clear;
            proto.setItem=function(k,v){
              var result=originalSet.call(this,k,v);
              try{window.webkit.messageHandlers.tkoStorage.postMessage({action:'set',key:String(k),value:String(v)});}catch(e){}
              return result;
            };
            proto.removeItem=function(k){
              var result=originalRemove.call(this,k);
              try{window.webkit.messageHandlers.tkoStorage.postMessage({action:'remove',key:String(k)});}catch(e){}
              return result;
            };
            proto.clear=function(){
              var result=originalClear.call(this);
              try{window.webkit.messageHandlers.tkoStorage.postMessage({action:'clear'});}catch(e){}
              return result;
            };
            Object.defineProperty(proto,'__tkoDurableWrapped',{value:true});
          } catch(e) { console.warn('TKO durable storage bootstrap:',e); }
        })();
        """
    }

    private func persistWebStorage(_ body: [String: Any]) {
        let action = body["action"] as? String ?? ""
        var values = loadDurableWebStorage()
        switch action {
        case "set":
            guard let key = body["key"] as? String, let value = body["value"] as? String else { return }
            values[key] = value
        case "remove":
            guard let key = body["key"] as? String else { return }
            values.removeValue(forKey: key)
        case "clear":
            values.removeAll()
        case "merge", "snapshot":
            guard let incoming = body["data"] as? [String: String] else { return }
            // A lifecycle snapshot must never erase an already durable native copy.
            // Merge incoming values instead; this protects data if WebKit returns
            // a partial/empty snapshot while the app is transitioning to background.
            incoming.forEach { values[$0.key] = $0.value }
        default:
            return
        }
        writeDurableWebStorage(values)
    }

    // MARK: - Backup & Restore

    private func handleBackup(_ body: [String: Any]) {

        let action = body["action"] as? String ?? ""

        if action == "save" {

            let filename =
                body["filename"] as? String ?? "TKO-Backup.json"

            let json =
                body["json"] as? String ?? "{}"

            let safeName = filename.hasSuffix(".json")
                ? filename
                : filename + ".json"

            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent(safeName)

            do {
                var completeJSON = json
                if var payload = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any],
                   let deliveryData = deliveryStore.backupData(),
                   let deliveryObject = try? JSONSerialization.jsonObject(with: deliveryData) {
                    payload["deliveryNote"] = deliveryObject
                    let output = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
                    completeJSON = String(data: output, encoding: .utf8) ?? json
                }
                try Data(completeJSON.utf8).write(to: url, options: .atomic)

                let picker = UIDocumentPickerViewController(
                    forExporting: [url],
                    asCopy: true
                )

                picker.delegate = self
                present(picker, animated: true)

            } catch {
                showMessage(
                    "Backup Failed",
                    error.localizedDescription
                )
            }

        } else if action == "restoreDeliveryNote" {
            guard let deliveryObject = body["data"],
                  JSONSerialization.isValidJSONObject(deliveryObject),
                  let deliveryJSON = try? JSONSerialization.data(withJSONObject: deliveryObject),
                  let deliveryBackup = try? JSONDecoder.backup.decode(DeliveryBackup.self, from: deliveryJSON) else {
                showMessage("Restore Failed", "Delivery Note backup data is invalid.")
                return
            }
            deliveryStore.restore(deliveryBackup)
        } else if action == "restore" {

            let picker = UIDocumentPickerViewController(
                forOpeningContentTypes: [.json],
                asCopy: true
            )

            picker.delegate = self
            pendingRestore = true

            present(picker, animated: true)
        }
    }

    func documentPicker(
        _ controller: UIDocumentPickerViewController,
        didPickDocumentsAt urls: [URL]
    ) {

        guard let url = urls.first else { return }

        if pendingRestore {

            pendingRestore = false

            let accessed = url.startAccessingSecurityScopedResource()

            defer {
                if accessed {
                    url.stopAccessingSecurityScopedResource()
                }
            }

            do {

                let data = try Data(contentsOf: url)

                guard let json = String(
                    data: data,
                    encoding: .utf8
                ) else {

                    showMessage(
                        "Restore Failed",
                        "Invalid JSON file."
                    )

                    return
                }

                let encoded = try JSONSerialization.data(
                    withJSONObject: json,
                    options: [.fragmentsAllowed]
                )

                let jsString = String(
                    data: encoded,
                    encoding: .utf8
                ) ?? "\"\""

                let javascript = """
                if (typeof window.restoreBackupJsonFromAndroid === 'function') {
                    window.restoreBackupJsonFromAndroid(\(jsString));
                } else {
                    alert('Restore function is not available.');
                }
                """

                webView.evaluateJavaScript(javascript) {
                    _, error in

                    if let error = error {
                        print("Restore JS error:", error)
                    }
                }

            } catch {

                showMessage(
                    "Restore Failed",
                    error.localizedDescription
                )
            }
        }
    }

    func documentPickerWasCancelled(
        _ controller: UIDocumentPickerViewController
    ) {
        pendingRestore = false
    }

    // MARK: - Text To Speech

    private func speak(_ text: String) {

        guard !text.isEmpty else { return }

        speech.stopSpeaking(at: .immediate)

        let utterance = AVSpeechUtterance(string: text)

        utterance.rate = 0.48
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0

        speech.speak(utterance)
    }

    // MARK: - Viber / Share

    private func handleShare(_ body: [String: Any]) {

        if let dataURL = body["dataURL"] as? String,
           let comma = dataURL.firstIndex(of: ",") {

            let base64 = String(
                dataURL[dataURL.index(after: comma)...]
            )

            if let data = Data(base64Encoded: base64) {

                let filename =
                    body["filename"] as? String ?? "TKO-Voucher.png"

                let safeFilename = URL(fileURLWithPath: filename)
                    .lastPathComponent

                let url = FileManager.default.temporaryDirectory
                    .appendingPathComponent(safeFilename)

                do {

                    try data.write(to: url, options: .atomic)

                    presentShareSheet(items: [url])

                } catch {

                    showMessage(
                        "Share Failed",
                        error.localizedDescription
                    )
                }
            }

        } else if let text = body["text"] as? String {

            presentShareSheet(items: [text])
        }
    }

    private func presentShareSheet(items: [Any]) {

        let activity = UIActivityViewController(
            activityItems: items,
            applicationActivities: nil
        )

        if let popover = activity.popoverPresentationController {

            popover.sourceView = view

            popover.sourceRect = CGRect(
                x: view.bounds.midX,
                y: view.bounds.midY,
                width: 1,
                height: 1
            )
        }

        present(activity, animated: true)
    }

    // MARK: - Alert

    private func showMessage(
        _ title: String,
        _ message: String
    ) {

        let alert = UIAlertController(
            title: title,
            message: message,
            preferredStyle: .alert
        )

        alert.addAction(
            UIAlertAction(title: "OK", style: .default)
        )

        present(alert, animated: true)
    }

    // MARK: - JavaScript Compatibility Bridge

    private static let bridgeScript = #"""

    (function () {

      if (window.__tkoIOSBridgeInstalled) return;

      window.__tkoIOSBridgeInstalled = true;

      function post(name, payload) {

        try {

          window.webkit.messageHandlers[name].postMessage(payload);

        } catch (e) {

          console.log('TKO iOS Bridge:', e);

        }
      }

      window.TKODeliveryNote = {
        open: function() {
          post('tkoDeliveryNote', {action: 'open'});
        }
      };

      window.TKOAunglan = {
        open: function() {
          post('tkoAunglan', {action: 'open'});
        }
      };

      window.AndroidBackup = {

        saveBackup: function(filename, json) {

          post('tkoBackup', {
            action: 'save',
            filename: filename || 'TKO-Backup.json',
            json: json || '{}'
          });

        },

        openRestoreFile: function() {
          post('tkoBackup', { action: 'restore' });
        },

        restoreDeliveryNote: function(data) {
          post('tkoBackup', { action: 'restoreDeliveryNote', data: data || {} });
        }
      };

      window.AndroidTTS = {

        speak: function(text) {

          post('tkoTTS', {
            text: String(text || '')
          });

        }
      };

      window.AndroidViber = {

        shareToViber: function(text) {
          post('tkoShare', {text: String(text || '')});
        },

        shareText: function(text) {
          post('tkoShare', {text: String(text || '')});
        },

        share: function(text) {
          post('tkoShare', {text: String(text || '')});
        },

        openViber: function(text) {
          post('tkoShare', {text: String(text || '')});
        },

        shareImageToViber: function(dataURL, filename, caption) {

          post('tkoShare', {
            dataURL: dataURL,
            filename: filename || 'TKO-Voucher.png',
            caption: caption || ''
          });

        }
      };

      window.AndroidNotifications = {

        updatePendingTodoCount: function(count) {

          // Notification integration can be added separately.

        }
      };

    })();

    """#
}