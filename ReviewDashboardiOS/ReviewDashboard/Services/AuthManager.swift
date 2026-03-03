import Foundation
import Combine

class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var currentUser: User?
    @Published var isLoggedIn: Bool = false

    private init() {
        loadStoredUser()
    }

    private func loadStoredUser() {
        if let data = UserDefaults.standard.data(forKey: "current_user") {
            if let user = try? JSONDecoder().decode(User.self, from: data) {
                self.currentUser = user
                self.isLoggedIn = true
            }
        }
    }

    func login(user: User, token: String) {
        UserDefaults.standard.set(token, forKey: "auth_token")
        if let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: "current_user")
        }
        DispatchQueue.main.async {
            self.currentUser = user
            self.isLoggedIn = true
        }
    }

    func logout() {
        UserDefaults.standard.removeObject(forKey: "auth_token")
        UserDefaults.standard.removeObject(forKey: "current_user")
        DispatchQueue.main.async {
            self.currentUser = nil
            self.isLoggedIn = false
        }
    }

    var token: String? {
        UserDefaults.standard.string(forKey: "auth_token")
    }

    var isAdmin: Bool {
        currentUser?.isAdmin == true
    }

    func canAccess(module: String) -> Bool {
        guard let user = currentUser else { return false }
        if user.isAdmin { return true }
        let modules = user.module_access ?? ["tasks", "employees"]
        let normalized = module.lowercased().replacingOccurrences(of: "-", with: "_")
        return modules.map { $0.lowercased().replacingOccurrences(of: "-", with: "_") }.contains(normalized)
    }
}
