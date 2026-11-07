import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack { DashboardView() }
                .tabItem { Label("Today", systemImage: "house.fill") }
            NavigationStack { EntriesView() }
                .tabItem { Label("Entries", systemImage: "list.bullet.rectangle") }
            NavigationStack { ToolsView() }
                .tabItem { Label("Tools", systemImage: "square.grid.2x2.fill") }
            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
        }
    }
}
