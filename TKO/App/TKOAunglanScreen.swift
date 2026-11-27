import SwiftUI
import WebKit
import UIKit

/// Aunglan runs inside TKO using the same hosted Aunglan website as the standalone app.
struct TKOAunglanScreen: View {
    let onClose: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            TKOAunglanWebView()
                .ignoresSafeArea()

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 38, height: 38)
                    .background(Color.black.opacity(0.62))
                    .clipShape(Circle())
            }
            .padding(.top, 52)
            .padding(.trailing, 14)
            .accessibilityLabel("Close Aunglan")
        }
        .background(Color.black)
    }
}

private struct TKOAunglanWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Keep Aunglan website storage isolated from TKO local-file WebView storage.
        // This prevents the separately hosted Update page from sharing or affecting
        // the persistent WebsiteDataStore used by TKO and Cargo Records.
        configuration.websiteDataStore = .nonPersistent()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator

        if let url = URL(string: "https://tko80.github.io/Aunglan-iPhone/") {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private func openExternally(_ url: URL) {
            DispatchQueue.main.async {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            let scheme = (url.scheme ?? "").lowercased()
            let host = (url.host ?? "").lowercased()

            if ["tel", "sms", "mailto", "kbzpay", "viber"].contains(scheme) {
                decisionHandler(.cancel)
                openExternally(url)
                return
            }
            if scheme == "https" && host == "apps.apple.com" {
                decisionHandler(.cancel)
                openExternally(url)
                return
            }
            if scheme == "http" || scheme == "https" {
                decisionHandler(.allow)
                return
            }

            decisionHandler(.cancel)
            openExternally(url)
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: "Aunglan", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            present(alert, from: webView)
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: "Aunglan", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in completionHandler(true) })
            present(alert, from: webView)
        }

        private func present(_ alert: UIAlertController, from webView: WKWebView) {
            guard let controller = webView.window?.rootViewController else { return }
            var top = controller
            while let presented = top.presentedViewController { top = presented }
            top.present(alert, animated: true)
        }
    }
}
