
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

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = .systemBackground

        setupWebView()
        loadLocalApp()
    }

    // MARK: - WebView Setup

    private func setupWebView() {

        let contentController = WKUserContentController()

        contentController.add(self, name: "tkoBackup")
        contentController.add(self, name: "tkoTTS")
        contentController.add(self, name: "tkoShare")

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
        webView.backgroundColor = .white
        webView.scrollView.backgroundColor = .white

        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.alwaysBounceVertical = true
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

        case "tkoTTS":
            let text = body["text"] as? String ?? ""
            speak(text)

        case "tkoShare":
            handleShare(body)

        default:
            break
        }
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

                try Data(json.utf8).write(
                    to: url,
                    options: .atomic
                )

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

      window.AndroidBackup = {

        saveBackup: function(filename, json) {

          post('tkoBackup', {
            action: 'save',
            filename: filename || 'TKO-Backup.json',
            json: json || '{}'
          });

        },

        openRestoreFile: function() {

          post('tkoBackup', {
            action: 'restore'
          });

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
