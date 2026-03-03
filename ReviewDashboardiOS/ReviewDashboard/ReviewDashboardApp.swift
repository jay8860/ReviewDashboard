import SwiftUI

@main
struct ReviewDashboardApp: App {
    @StateObject private var authManager = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authManager)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var auth: AuthManager

    var body: some View {
        if auth.isLoggedIn {
            MainTabView()
                .environmentObject(auth)
        } else {
            LoginView()
                .environmentObject(auth)
        }
    }
}
