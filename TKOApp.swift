import SwiftUI

@main
struct TKOApp: App {
    var body: some Scene {
        WindowGroup {
            TKOWebViewScreen()
                .ignoresSafeArea()
        }
    }
}
