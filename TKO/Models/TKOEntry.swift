import Foundation

struct TKOEntry: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var date: Date = Date()
    var company: String
    var name: String
    var town: String
    var quantity: Int
}

struct TKOBackup: Codable {
    var entries: [TKOEntry]
    var exportedAt: Date
}
