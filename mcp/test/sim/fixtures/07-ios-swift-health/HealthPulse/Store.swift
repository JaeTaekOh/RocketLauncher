import StoreKit

@MainActor final class Store: ObservableObject {
    func load() async throws { let products = try await Product.products(for: ["pulse.pro.monthly"]); _ = try await products.first?.purchase() }
}
