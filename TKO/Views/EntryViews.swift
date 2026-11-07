
import SwiftUI

struct EntriesView: View {
    @EnvironmentObject private var store: TKOStore
    @State private var showAdd = false

    var body: some View {
        List {
            if store.entries.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "tray")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)

                    Text("No saved entries")
                        .font(.headline)

                    Text("Tap + to add your first entry.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
            }

            ForEach(store.entries) { entry in
                EntryRow(entry: entry)
            }
            .onDelete { offsets in
                offsets.map { store.entries[$0] }
                    .forEach(store.delete)
            }
        }
        .navigationTitle("Saved Entries")
        .navigationBarItems(
            trailing: Button(action: {
                showAdd = true
            }) {
                Image(systemName: "plus")
            }
        )
        .sheet(isPresented: $showAdd) {
            NavigationStack {
                AddEntryView()
            }
        }
    }
}

struct EntryRow: View {
    let entry: TKOEntry

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.green.opacity(0.12))
                .frame(width: 42, height: 42)
                .overlay(
                    Image(systemName: "shippingbox.fill")
                        .foregroundStyle(.green)
                )

            VStack(alignment: .leading, spacing: 3) {
                Text("\(entry.company) · \(entry.name)")
                    .font(.headline)

                Text(entry.town)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Text(entry.date.formatted(
                    date: .abbreviated,
                    time: .shortened
                ))
                .font(.caption)
                .foregroundStyle(.tertiary)
            }

            Spacer()

            Text("×\(entry.quantity)")
                .font(.headline.monospacedDigit())
        }
        .padding(.vertical, 4)
    }
}

struct AddEntryView: View {
    @EnvironmentObject private var store: TKOStore
    @Environment(\.dismiss) private var dismiss

    @State private var company = ""
    @State private var name = ""
    @State private var town = ""
    @State private var quantity = "1"
    @State private var error: String?

    var body: some View {
        Form {
            Section("Entry Details") {
                TextField("Company", text: $company)
                TextField("Name", text: $name)
                TextField("Town", text: $town)

                TextField("Quantity", text: $quantity)
                    .keyboardType(.numberPad)
            }

            Section {
                Button("Save Entry") {
                    save()
                }
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("New Entry")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Cancel") {
                    dismiss()
                }
            }
        }
        .alert(
            "Unable to Save",
            isPresented: Binding(
                get: { error != nil },
                set: { if !$0 { error = nil } }
            )
        ) {
            Button("OK", role: .cancel) {
                error = nil
            }
        } message: {
            Text(error ?? "")
        }
    }

    private func save() {
        do {
            try store.add(
                company: company,
                name: name,
                town: town,
                quantity: Int(quantity) ?? 0
            )

            SpeechService.shared.speak(
                "Saved successfully. \(company), \(name), \(town), quantity \(quantity)"
            )

            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
