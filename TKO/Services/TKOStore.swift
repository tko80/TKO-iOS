import Foundation
import Combine

@MainActor
final class TKOStore: ObservableObject {
    @Published private(set) var entries: [TKOEntry] = []
    private let fileURL: URL

    init() {
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        fileURL = directory.appendingPathComponent("tko-entries.json")
        load()
    }

    func add(company: String, name: String, town: String, quantity: Int) throws {
        let values = [company, name, town].map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        guard values.allSatisfy({ !$0.isEmpty }), quantity > 0 else {
            throw StoreError.invalidEntry
        }
        entries.insert(TKOEntry(company: values[0], name: values[1], town: values[2], quantity: quantity), at: 0)
        try persist()
    }

    func delete(_ entry: TKOEntry) {
        entries.removeAll { $0.id == entry.id }
        try? persist()
    }

    func backupData() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(TKOBackup(entries: entries, exportedAt: Date()))
    }

    func restore(from data: Data) throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let backup = try? decoder.decode(TKOBackup.self, from: data) {
            entries = backup.entries
        } else {
            entries = try decoder.decode([TKOEntry].self, from: data)
        }
        try persist()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        entries = (try? decoder.decode([TKOEntry].self, from: data)) ?? []
    }

    private func persist() throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(entries).write(to: fileURL, options: .atomic)
    }

    enum StoreError: LocalizedError {
        case invalidEntry
        var errorDescription: String? { "Please complete all fields and enter a quantity greater than zero." }
    }
}
