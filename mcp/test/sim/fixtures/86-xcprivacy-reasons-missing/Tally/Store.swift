import Foundation
let d = UserDefaults.standard
func modified(_ u: URL) -> Date? { (try? FileManager.default.attributesOfItem(atPath: u.path))?[.modificationDate] as? Date }
