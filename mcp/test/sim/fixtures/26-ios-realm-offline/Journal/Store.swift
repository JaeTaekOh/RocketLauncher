import RealmSwift
final class Entry: Object { @Persisted var text = "" }
let realm = try! Realm()
