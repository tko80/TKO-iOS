import SwiftUI
import WebKit
import UniformTypeIdentifiers
import AVFoundation
import UIKit

struct TKOWebViewScreen: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> TKOWebViewController {
        TKOWebViewController()
    }

    func updateUIViewController(_ uiViewController: TKOWebViewController, context: Context) {}
}

final class TKOWebViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate {
    private var webView: WKWebView!
    private let speech = AVSpeechSynthesizer()
    private var pendingRestore = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let contentController = WKUserContentController()
        contentController.add(self, name: "tkoBackup")
        contentController.add(self, name: "tkoTTS")
        contentController.add(self, name: "tkoShare")
        contentController.addUserScript(WKUserScript(
            source: Self.bridgeScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.alwaysBounceVertical = true
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        view.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        loadLocalApp()
    }

    private func loadLocalApp() {
        guard let webDirectory = Bundle.main.resourceURL?.appendingPathComponent("WebApp", isDirectory: true),
              let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebApp") else {
            showLoadError()
            return
        }
        webView.loadFileURL(indexURL, allowingReadAccessTo: webDirectory)
    }

    private func showLoadError() {
        let alert = UIAlertController(title: "TKO files missing", message: "The original HTML, JavaScript and CSS files were not bundled. Please rebuild the GitHub project.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
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

    private func handleBackup(_ body: [String: Any]) {
        let action = body["action"] as? String ?? ""
        if action == "save" {
            let filename = (body["filename"] as? String ?? "TKO-Backup.json")
            let json = body["json"] as? String ?? "{}"
            let safeName = filename.hasSuffix(".json") ? filename : filename + ".json"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
            do {
                try Data(json.utf8).write(to: url, options: .atomic)
                let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                picker.delegate = self
                present(picker, animated: true)
            } catch {
                showMessage("Backup failed", error.localizedDescription)
            }
        } else if action == "restore" {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json], asCopy: true)
            picker.delegate = self
            pendingRestore = true
            present(picker, animated: true)
        }
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        if pendingRestore {
            pendingRestore = false
            do {
                let data = try Data(contentsOf: url)
                guard let json = String(data: data, encoding: .utf8) else {
                    showMessage("Restore failed", "The selected file is not valid UTF-8 JSON.")
                    return
                }
                let encoded = try JSONSerialization.data(withJSONObject: json, options: [.fragmentsAllowed])
                let jsString = String(data: encoded, encoding: .utf8) ?? "\"\""
                webView.evaluateJavaScript("if (typeof window.restoreBackupJsonFromAndroid === 'function') { window.restoreBackupJsonFromAndroid(\(jsString)); } else { alert('Restore function is not available.'); }")
            } catch {
                showMessage("Restore failed", error.localizedDescription)
            }
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingRestore = false
    }

    private func speak(_ text: String) {
        guard !text.isEmpty else { return }
        speech.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = 0.48
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0
        speech.speak(utterance)
    }

    private func handleShare(_ body: [String: Any]) {
        if let dataURL = body["dataURL"] as? String,
           let comma = dataURL.firstIndex(of: ","),
           let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) {
            let filename = body["filename"] as? String ?? "TKO-Share.png"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            do {
                try data.write(to: url, options: .atomic)
                presentShareSheet(items: [url])
            } catch {
                showMessage("Share failed", error.localizedDescription)
            }
        } else if let text = body["text"] as? String {
            presentShareSheet(items: [text])
        }
    }

    private func presentShareSheet(items: [Any]) {
        let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let popover = activity.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        }
        present(activity, animated: true)
    }

    private func showMessage(_ title: String, _ message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    private static let bridgeScript = #"""
    (function () {
      if (window.__tkoIOSBridgeInstalled) return;
      window.__tkoIOSBridgeInstalled = true;
      function post(name, payload) {
        try { window.webkit.messageHandlers[name].postMessage(payload); }
        catch (e) { console.log('TKO native bridge:', e); }
      }
      window.AndroidBackup = {
        saveBackup: function(filename, json) {
          post('tkoBackup', {action:'save', filename:filename || 'TKO-Backup.json', json:json || '{}'});
        },
        openRestoreFile: function() { post('tkoBackup', {action:'restore'}); }
      };
      window.AndroidTTS = { speak: function(text) { post('tkoTTS', {text:String(text || '')}); } };
      window.AndroidViber = {
        shareToViber: function(text) { post('tkoShare', {text:String(text || '')}); },
        shareText: function(text) { post('tkoShare', {text:String(text || '')}); },
        share: function(text) { post('tkoShare', {text:String(text || '')}); },
        openViber: function(text) { post('tkoShare', {text:String(text || '')}); },
        shareImageToViber: function(dataURL, filename, caption) {
          post('tkoShare', {dataURL:dataURL, filename:filename || 'TKO-Voucher.png', caption:caption || ''});
        }
      };
      window.AndroidNotifications = {
        updatePendingTodoCount: function(count) { /* badge-only Android hook; web reminders remain in the page */ }
      };
    })();
    """#
}
