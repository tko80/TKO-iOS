# TKO iOS (SwiftUI native starter)

This repository is the first native iOS port scaffold for the supplied Android TKO project.

## Included in this stage
- Native SwiftUI tab navigation and dashboard
- Native entry creation and saved-entry list
- Local JSON persistence
- JSON backup and restore using the iOS document picker
- English save confirmation using iOS speech synthesis
- Notification permission request
- GitHub Actions workflow that builds an unsigned iOS app and packages it as an IPA artifact

## Important feature-parity status
The supplied Android project contains a large HTML/JavaScript application. Its visible entry fields are Company, Name, Town and Quantity. The source also contains local data groups for entries, credit entries, date-based notes, To-Do data and debt data, plus Android-specific bridges for file backup/restore, text-to-speech, Viber sharing, notifications and OAuth callbacks.

This first native stage implements the core entry workflow and a working JSON backup/restore path. Credit/debt, notes, To-Do, voucher rendering/sharing, Google/Supabase sign-in and Google Sheets sync are not yet ported. They must be implemented and tested individually before calling this a complete feature-equivalent release. The source archive does not include a complete iOS OAuth client configuration or a confirmed Google Sheets endpoint configuration.

## Build IPA with GitHub Actions
1. Create a new GitHub repository named `TKO-iOS`.
2. Upload the contents of this folder to the repository root (including `.github`).
3. Open **Actions** and run **Build TKO iOS IPA** (or push to `main`).
4. Open the successful workflow run and download the `TKO-iOS-unsigned-IPA` artifact.
5. Use Sideloadly on a computer to sign the IPA with your Apple ID and install it on the iPhone.

The workflow deliberately creates an **unsigned** IPA. GitHub Actions does not sign it with your personal Apple ID. Sideloadly performs signing on your computer. A free Apple ID has Apple's free provisioning limitations and the app may need to be re-signed periodically.

## Local development
Requires macOS, Xcode 15 or later, and XcodeGen:

```bash
brew install xcodegen
xcodegen generate
open TKO.xcodeproj
```

Bundle identifier: `com.tinwinko.tko.ios` (kept distinct from Android's `com.tinwinko.tko`).
