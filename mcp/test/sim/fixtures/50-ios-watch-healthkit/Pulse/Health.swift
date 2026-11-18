import HealthKit
let store = HKHealthStore()
func ask() { store.requestAuthorization(toShare: nil, read: [HKQuantityType(.heartRate)]) { _, _ in } }
