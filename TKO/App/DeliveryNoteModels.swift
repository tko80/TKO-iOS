import Foundation
import Combine
struct DeliveryItem: Codable, Identifiable {
    var id = UUID()
    var name: String
    var quantity: String
}
struct DeliveryRecord: Codable, Identifiable {
    var id = UUID()
    var receiver: String
    var date: Date
    var items: [DeliveryItem]
    var note: String
    var signature: Data
}
struct DeliveryBackup: Codable { var app = "DeliveryNote"; var version = 1; var records: [DeliveryRecord] }
@MainActor final class DeliveryStore: ObservableObject {
    @Published var records: [DeliveryRecord] = []
    private let key = "deliverynote.records.v1"
    init() { load() }
    func load() {
        guard let data = UserDefaults.standard.data(forKey:key),
              let value = try? JSONDecoder().decode([DeliveryRecord].self, from:data) else { return }
        records = value.sorted { $0.date > $1.date }
    }
    func save(_ record: DeliveryRecord) {
        if let i = records.firstIndex(where: {$0.id == record.id}) { records[i] = record }
        else { records.insert(record, at:0) }
        persist()
    }
    func delete(_ record: DeliveryRecord) { records.removeAll{$0.id == record.id}; persist() }
    func restore(_ backup: DeliveryBackup) {
        records = backup.records.sorted { $0.date > $1.date }
        persist()
    }
    func backupData() -> Data? { try? JSONEncoder.pretty.encode(DeliveryBackup(records:records)) }
    private func persist() {
        if let data = try? JSONEncoder().encode(records) {
            UserDefaults.standard.set(data, forKey: key)
            UserDefaults.standard.synchronize()
        }
    }
}
extension JSONEncoder {
    static var pretty: JSONEncoder { let e=JSONEncoder(); e.outputFormatting=[.prettyPrinted,.sortedKeys]; e.dateEncodingStrategy = .iso8601; return e }
}
extension JSONDecoder { static var backup: JSONDecoder { let d=JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d } }