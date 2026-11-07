import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var store: TKOStore
    @State private var showAdd = false
    private var todayEntries: [TKOEntry] { store.entries.filter { Calendar.current.isDateInToday($0.date) } }
    private var total: Int { todayEntries.reduce(0) { $0 + $1.quantity } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("TKO").font(.largeTitle.bold())
                    Text(Date.now.formatted(date: .complete, time: .omitted)).foregroundStyle(.secondary)
                }
                HStack(spacing: 12) {
                    metric("Today's Entries", value: "\(todayEntries.count)", icon: "doc.text.fill")
                    metric("Total Quantity", value: "\(total)", icon: "shippingbox.fill")
                }
                Button { showAdd = true } label: {
                    Label("New Entry", systemImage: "plus.circle.fill")
                        .font(.headline).frame(maxWidth: .infinity).padding()
                        .background(Color.green, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.white)
                }
                HStack {
                    Text("Recent Entries").font(.title3.bold())
                    Spacer()
                    Text("\(store.entries.count) total").font(.caption).foregroundStyle(.secondary)
                }
                if store.entries.isEmpty {
    VStack(spacing: 12) {
        Image(systemName: "tray")
            .font(.system(size: 40))
            .foregroundStyle(.secondary)

        Text("No entries yet")
            .font(.headline)

        Text("Tap New Entry to add your first record.")
            .font(.subheadline)
            .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 30)
} else {
    ForEach(store.entries.prefix(5)) { entry in
        EntryRow(entry: entry)
    }
}
            }.padding()
        }
        .navigationBarHidden(true)
        .sheet(isPresented: $showAdd) { NavigationStack { AddEntryView() } }
    }

    private func metric(_ title: String, value: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon).font(.title2).foregroundStyle(.green)
            Text(value).font(.title.bold())
            Text(title).font(.caption).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity, alignment: .leading).padding().background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}
