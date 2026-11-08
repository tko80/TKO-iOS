# TKO iOS — Original HTML app in WKWebView

This project packages the supplied original TKO web app (`index.html`, `script.js`, `style.css`, and `night-background.png`) inside an iOS WKWebView. It does not replace the HTML interface with a new SwiftUI interface.

## GitHub repository layout

Upload the contents of this folder to the root of `tko80/TKO-iOS`:

- `.github/workflows/ios-ipa.yml`
- `project.yml`
- `TKO/App/` (SwiftUI app shell and iOS bridges)
- `TKO/WebApp/` (original HTML/CSS/JavaScript and background image)

For a clean replacement, remove the previous `TKO` folder and `project.yml` first, then upload these new ones. Keep the workflow path shown above.

## iOS integrations

- Local HTML app and its JavaScript run inside WKWebView.
- WKWebView's persistent website data store is used for web storage.
- Backup uses the iOS document export picker.
- Restore uses the iOS document picker and calls the existing `restoreBackupJsonFromAndroid` JavaScript function.
- Text-to-speech uses AVSpeechSynthesizer.
- Text and voucher-image sharing use the iOS share sheet (Viber may appear if installed and supported by iOS).

Some web features that depend on external services still require their original valid configuration and network access. This workflow creates an **unsigned IPA**; install it with Sideloadly using your Apple ID. A free Apple ID has signing/refresh limits.
