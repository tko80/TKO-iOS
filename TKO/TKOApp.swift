import SwiftUI

@main
struct TKOApp: App {
    @StateObject private var store = TKOStore()
    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environmentObject(store)
                .tint(Color(red: 0.10, green: 0.62, blue: 0.36))
        }
    }
}
