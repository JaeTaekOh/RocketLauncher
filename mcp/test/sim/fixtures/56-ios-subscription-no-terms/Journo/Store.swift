import StoreKit
@MainActor final class Store {
  func load() async throws { let p = try await Product.products(for: ["journo.pro.monthly", "journo.pro.yearly"]); _ = p.first?.subscription?.subscriptionPeriod }
}
