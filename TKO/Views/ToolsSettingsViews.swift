import SwiftUI
import UniformTypeIdentifiers
import UserNotifications

struct ToolsView: View {
    @EnvironmentObject private var store: TKOStore
    @State private var showExporter = false
    @State private var backupData = Data()
    @State private var showImporter = false
    @State private var message: String?
    var body: some View {
        List {
            Section("Data") {
                Button { exportBackup() } label: { Label("Backup Data", systemImage: "square.and.arrow.up") }
                Button { showImporter = true } label: { Label("Restore Data", systemImage: "square.and.arrow.down") }
            }
            Section("Coming in native iOS build") {
                Label("Credit & Debt Records", systemImage: "creditcard")
                Label("To-Do Reminders", systemImage: "checklist")
                Label("Notes & Remarks", systemImage: "note.text")
                Label("Voucher Export & Viber Sharing", systemImage: "square.and.arrow.up.on.square")
                Label("Google Sheets Sync", systemImage: "tablecells")
            }
        }
        .navigationTitle("Tools")
        .fileExporter(isPresented: $showExporter, document: BackupDocument(data: backupData), contentType: .json, defaultFilename: "TKO-Backup") { result in
            if case .failure(let error) = result { message = error.localizedDescription }
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                try store.restore(from: Data(contentsOf: url))
                message = "Backup restored successfully."
            } catch { message = error.localizedDescription }
        }
        .alert("TKO", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("OK", role: .cancel) { message = nil }
        } message: { Text(message ?? "") }
    }
    private func exportBackup() {
        do { backupData = try store.backupData(); showExporter = true }
        catch { message = error.localizedDescription }
    }
}


struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] {
        [.json]
    }

    var data: Data

    init(data: Data = Data()) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        return FileWrapper(regularFileWithContents: data)
    }
}


struct SettingsView: View {
    @State private var notificationStatus = "Not requested"
    var body: some View {
        Form {
            Section("App") {
                LabeledContent("Application", value: "TKO")
                LabeledContent("Version", value: "1.0.0 (iOS)")
                LabeledContent("Bundle ID", value: "com.tinwinko.tko.ios")
            }
            Section("Notifications") {
                Text(notificationStatus).font(.caption).foregroundStyle(.secondary)
                Button("Enable Notifications") {
                    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                        DispatchQueue.main.async { notificationStatus = granted ? "Enabled" : "Permission not granted" }
                    }
                }
            }
            Section("Account & Cloud") {
                Text("Google / Supabase sign-in and Google Sheets sync require the original provider configuration and will be connected in the next integration stage.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }.navigationTitle("Settings")
    }
}
