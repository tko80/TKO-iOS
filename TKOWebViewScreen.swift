
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
    WKUIDelegate,
    WKScriptMessageHandler,
    UIDocumentPickerDelegate {

    private var webView: WKWebView!
    private let speech = AVSpeechSynthesizer()

    private var pendingRestore = false
    private var pendingRestoreJSON: String?

    // MARK: - View Lifecycle

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

        contentController.addUserScript(
            WKUserScript(
                source: Self.bridgeScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let configuration = WKWebViewConfiguration()

        configuration.userContentController = contentController
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        webView = WKWebView(
            frame: .zero,
            configuration: configuration
        )

        webView.navigationDelegate = self
        webView.uiDelegate = self

        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear

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

        let webDirectory = resourceURL.appendingPathComponent(
            "WebApp",
            isDirectory: true
        )

        let indexURL = webDirectory.appendingPathComponent(
            "index.html"
        )

        var isDirectory: ObjCBool = false

        guard FileManager.default.fileExists(
            atPath: webDirectory.path,
            isDirectory: &isDirectory
        ), isDirectory.boolValue else {
            showLoadError("WebApp folder is missing from App Bundle.")
            return
        }

        guard FileManager.default.fileExists(
            atPath: indexURL.path
        ) else {
            showLoadError("WebApp/index.html was not found.")
            return
        }

        guard FileManager.default.isReadableFile(
            atPath: indexURL.path
        ) else {
            showLoadError("Cannot read WebApp/index.html.")
            return
        }

        let files = (try? FileManager.default.contentsOfDirectory(
            atPath: webDirectory.path
        )) ?? []

        print("TKO WebApp:", webDirectory.path)
        print("TKO Files:", files)

        webView.loadFileURL(
            indexURL,
            allowingReadAccessTo: webDirectory
        )
    }

    // MARK: - Navigation Delegate

    func webView(
        _ webView: WKWebView,
        didFinish navigation: WKNavigation!
    ) {

        print("TKO HTML loaded successfully")

        if let json = pendingRestoreJSON {
            executeRestore(json)
        }
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {

        print("TKO loading error:", error.localizedDescription)

        showLoadError(error.localizedDescription)
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {

        print("TKO navigation error:", error.localizedDescription)
    }

    func webViewWebContentProcessDidTerminate(
        _ webView: WKWebView
    ) {

        print("WebKit process terminated. Reloading.")

        loadLocalApp()
    }

    // MARK: - JavaScript Alert

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {

        let alert = UIAlertController(
            title: "TKO",
            message: message,
            preferredStyle: .alert
        )

        alert.addAction(
            UIAlertAction(title: "OK", style: .default) { _ in
                completionHandler()
            }
        )

        present(alert, animated: true)
    }

    // MARK: - JavaScript Confirm

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {

        let alert = UIAlertController(
            title: "TKO Confirmation",
            message: message,
            preferredStyle: .alert
        )

        alert.addAction(
            UIAlertAction(title: "Cancel", style: .cancel) { _ in
                completionHandler(false)
            }
        )

        alert.addAction(
            UIAlertAction(title: "Continue", style: .default) { _ in
                completionHandler(true)
            }
        )

        present(alert, animated: true)
    }

    // MARK: - JavaScript Prompt

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {

        let alert = UIAlertController(
            title: "TKO",
            message: prompt,
            preferredStyle: .alert
        )

        alert.addTextField { field in
            field.text = defaultText
        }

        alert.addAction(
            UIAlertAction(title: "Cancel", style: .cancel) { _ in
                completionHandler(nil)
            }
        )

        alert.addAction(
            UIAlertAction(title: "OK", style: .default) { _ in
                completionHandler(
                    alert.textFields?.first?.text
                )
            }
        )

        present(alert, animated: true)
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
            speak(body["text"] as? String ?? "")

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

            let safeName = URL(
                fileURLWithPath: filename
            ).lastPathComponent

            let finalName = safeName.hasSuffix(".json")
                ? safeName
                : safeName + ".json"

            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent(finalName)

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

            showRestoreConfirmation()
        }
    }

    // MARK: - Restore Confirmation

    private func showRestoreConfirmation() {

        let alert = UIAlertController(
            title: "Restore Backup",
            message: "Select your TKO backup JSON file. Restoring may replace existing data.",
            preferredStyle: .alert
        )

        alert.addAction(
            UIAlertAction(title: "Cancel", style: .cancel)
        )

        alert.addAction(
            UIAlertAction(title: "Choose File", style: .default) {
                [weak self] _ in

                self?.openRestorePicker()
            }
        )

        present(alert, animated: true)
    }

    private func openRestorePicker() {

        let picker = UIDocumentPickerViewController(
            forOpeningContentTypes: [.json],
            asCopy: true
        )

        picker.delegate = self
        picker.allowsMultipleSelection = false

        pendingRestore = true

        present(picker, animated: true)
    }

    // MARK: - Document Picker

    func documentPicker(
        _ controller: UIDocumentPickerViewController,
        didPickDocumentsAt urls: [URL]
    ) {

        guard let url = urls.first else {
            pendingRestore = false
            return
        }

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

                // Validate JSON before restoring.
                let object = try JSONSerialization.jsonObject(
                    with: data,
                    options: [.fragmentsAllowed]
                )

                guard JSONSerialization.isValidJSONObject(object) else {
                    throw NSError(
                        domain: "TKORestore",
                        code: 1,
                        userInfo: [
                            NSLocalizedDescriptionKey:
                                "Invalid backup JSON structure."
                        ]
                    )
                }

                guard let json = String(
                    data: data,
                    encoding: .utf8
                ) else {
                    throw NSError(
                        domain: "TKORestore",
                        code: 2,
                        userInfo: [
                            NSLocalizedDescriptionKey:
                                "Cannot read JSON as UTF-8."
                        ]
                    )
                }

                pendingRestoreJSON = json

                executeRestore(json)

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
        pendingRestoreJSON = nil
    }

    // MARK: - Execute Restore

    private func executeRestore(_ json: String) {

        guard webView != nil else { return }

        let encoded = try? JSONSerialization.data(
            withJSONObject: json,
            options: [.fragmentsAllowed]
        )

        guard let encoded = encoded,
              let jsString = String(
                data: encoded,
                encoding: .utf8
              ) else {

            showMessage(
                "Restore Failed",
                "Could not prepare backup data."
            )

            return
        }

        let javascript = """
        (function() {
            if (typeof window.restoreBackupJsonFromAndroid === 'function') {
                window.restoreBackupJsonFromAndroid(\(jsString));
                return 'restore_called';
            }

            if (typeof window.restoreBackupJson === 'function') {
                window.restoreBackupJson(\(jsString));
                return 'restore_called';
            }

            return 'restore_function_missing';
        })();
        """

        webView.evaluateJavaScript(javascript) {
            [weak self] result, error in

            guard let self = self else { return }

            if let error = error {

                self.pendingRestoreJSON = nil

                self.showMessage(
                    "Restore Failed",
                    error.localizedDescription
                )

                return
            }

            let status = result as? String ?? ""

            if status == "restore_function_missing" {

                self.pendingRestoreJSON = nil

                self.showMessage(
                    "Restore Failed",
                    "The HTML Restore function was not found. Please check restoreBackupJsonFromAndroid() in script.js."
                )

            } else {

                self.pendingRestoreJSON = nil

                self.showMessage(
                    "Restore",
                    "Restore function has been called. Please check your saved entries."
                )
            }
        }
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

    // MARK: - Share / Viber

    private func handleShare(_ body: [String: Any]) {

        if let dataURL = body["dataURL"] as? String,
           let comma = dataURL.firstIndex(of: ",") {

            let base64 = String(
                dataURL[dataURL.index(after: comma)...]
            )

            guard let data = Data(base64Encoded: base64) else {
                showMessage("Share Failed", "Invalid image data.")
                return
            }

            let filename =
                body["filename"] as? String ?? "TKO-Voucher.png"

            let safeName = URL(
                fileURLWithPath: filename
            ).lastPathComponent

            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent(safeName)

            do {

                try data.write(
                    to: url,
                    options: .atomic
                )

                presentShareSheet(items: [url])

            } catch {

                showMessage(
                    "Share Failed",
                    error.localizedDescription
                )
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

    // MARK: - Messages

    private func showMessage(
        _ title: String,
        _ message: String
    ) {

        DispatchQueue.main.async {

            let alert = UIAlertController(
                title: title,
                message: message,
                preferredStyle: .alert
            )

            alert.addAction(
                UIAlertAction(title: "OK", style: .default)
            )

            self.present(alert, animated: true)
        }
    }

    private func showLoadError(_ message: String) {

        showMessage(
            "TKO Loading Error",
            message
        )
    }

    // MARK: - JavaScript Bridge

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
                // Kept for original HTML compatibility.
            }

        };

    })();

    """#
}
