import Foundation
import Combine

enum PreferredCategory: String {
    case company
    case name
    case town
}

@MainActor
final class TKOStore: ObservableObject {
    @Published private(set) var entries: [TKOEntry] = []
    @Published private(set) var preferredCompanies: [String] = []
    @Published private(set) var preferredNames: [String] = []
    @Published private(set) var preferredTowns: [String] = []

    private let fileURL: URL
    private let preferences = UserDefaults.standard

    init() {
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        fileURL = directory.appendingPathComponent("tko-entries.json")
        load()
        loadPreferredValues()
    }

    func preferredValues(for category: PreferredCategory) -> [String] {
        switch category {
        case .company: return preferredCompanies
        case .name: return preferredNames
        case .town: return preferredTowns
        }
    }

    func addPreferred(_ value: String, for category: PreferredCategory) -> Bool {
        let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return false }
        var values = preferredValues(for: category)
        guard !values.contains(where: { $0.caseInsensitiveCompare(cleaned) == .orderedSame }) else { return false }
        values.append(cleaned)
        values.sort { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
        setPreferredValues(values, for: category)
        return true
    }

    func updatePreferred(_ oldValue: String, to newValue: String, for category: PreferredCategory) -> Bool {
        let cleaned = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return false }
        var values = preferredValues(for: category)
        guard let index = values.firstIndex(of: oldValue) else { return false }
        guard !values.contains(where: { $0 != oldValue && $0.caseInsensitiveCompare(cleaned) == .orderedSame }) else { return false }
        values[index] = cleaned
        values.sort { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
        setPreferredValues(values, for: category)
        return true
    }

    func deletePreferred(_ value: String, for category: PreferredCategory) {
        var values = preferredValues(for: category)
        values.removeAll { $0 == value }
        setPreferredValues(values, for: category)
    }

    private func setPreferredValues(_ values: [String], for category: PreferredCategory) {
        preferences.set(values, forKey: "tko.preferred.\(category.rawValue)")
        switch category {
        case .company: preferredCompanies = values
        case .name: preferredNames = values
        case .town: preferredTowns = values
        }
    }

    private func loadPreferredValues() {
        preferredCompanies = preferences.stringArray(forKey: "tko.preferred.company") ?? []
        preferredNames = preferences.stringArray(forKey: "tko.preferred.name") ?? []
        preferredTowns = preferences.stringArray(forKey: "tko.preferred.town") ?? []
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
        var errorDescription: String? {
            "Please complete all fields and enter a quantity greater than zero."
        }
    }
}
