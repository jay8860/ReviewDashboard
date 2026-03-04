import SwiftUI
import WebKit
import UIKit

struct MainTabView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var selectedTab = 0

    private var availableTabs: [(Int, String, String, AnyView)] {
        var tabs: [(Int, String, String, AnyView)] = []
        var idx = 0

        if auth.canAccess(module: "tasks") {
            tabs.append((idx, "Tasks", "checklist", AnyView(
                NavigationStack {
                    PortalModuleContainer(title: "Tasks", route: "/tasks")
                }
            )))
            idx += 1
        }
        if auth.canAccess(module: "todos") {
            tabs.append((idx, "To-Do List", "list.bullet", AnyView(
                NavigationStack {
                    PortalModuleContainer(title: "To-Do List", route: "/todos")
                }
            )))
            idx += 1
        }
        if auth.canAccess(module: "departments") {
            tabs.append((idx, "Departments", "building.2", AnyView(
                NavigationStack {
                    PortalModuleContainer(title: "Departments", route: "/departments")
                }
            )))
            idx += 1
        }
        if auth.canAccess(module: "field_visits") {
            tabs.append((idx, "Field Visits", "map", AnyView(
                NavigationStack {
                    PortalModuleContainer(title: "Field Visits", route: "/field-visits")
                }
            )))
            idx += 1
        }
        tabs.append((idx, "More", "ellipsis.circle", AnyView(MoreHubView())))
        return tabs
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(availableTabs, id: \.0) { (index, label, icon, view) in
                view
                    .tabItem {
                        Label(label, systemImage: icon)
                    }
                    .tag(index)
            }
        }
        .tint(Color.brandIndigo)
    }
}

struct PortalModuleContainer: View {
    @EnvironmentObject var auth: AuthManager
    let title: String
    let route: String

    @State private var reloadID = UUID()

    var body: some View {
        DashboardWebView(
            route: route,
            token: auth.token,
            user: auth.currentUser,
            reloadID: reloadID
        )
        .ignoresSafeArea(edges: .bottom)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { reloadID = UUID() }) {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
    }
}

struct DashboardWebView: UIViewRepresentable {
    let route: String
    let token: String?
    let user: User?
    let reloadID: UUID

    func makeCoordinator() -> Coordinator {
        Coordinator(baseURL: APIService.shared.baseURL)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.keyboardDismissMode = .onDrag

        context.coordinator.attach(webView)
        _ = context.coordinator.syncAuth(token: token, user: user)
        context.coordinator.load(route: route, force: false)
        context.coordinator.lastReloadID = reloadID

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.attach(webView)
        let authChanged = context.coordinator.syncAuth(token: token, user: user)
        context.coordinator.injectRuntimeAuth()

        let routeChanged = context.coordinator.currentRoute != context.coordinator.normalize(route)
        let reloadChanged = context.coordinator.lastReloadID != reloadID

        if routeChanged {
            context.coordinator.load(route: route, force: false)
        } else if reloadChanged {
            context.coordinator.load(route: route, force: true)
        } else if authChanged {
            context.coordinator.injectRuntimeAuth()
        }
        context.coordinator.lastReloadID = reloadID
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let baseURL: String
        weak var webView: WKWebView?

        var currentRoute: String = ""
        var authSignature: String = ""
        var runtimeScript: String = ""
        var lastReloadID: UUID = UUID()

        init(baseURL: String) {
            self.baseURL = baseURL
        }

        func attach(_ webView: WKWebView) {
            self.webView = webView
        }

        func normalize(_ route: String) -> String {
            let trimmed = route.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { return "/" }
            return trimmed.hasPrefix("/") ? trimmed : "/\(trimmed)"
        }

        func signature(token: String?, user: User?) -> String {
            let tokenPart = token ?? ""
            let userPart: String
            if let user = user {
                let modules = (user.module_access ?? []).joined(separator: ",")
                userPart = "\(user.id)|\(user.username)|\(user.role)|\(modules)"
            } else {
                userPart = ""
            }
            return "\(tokenPart)::\(userPart)"
        }

        func jsEscapedString(_ value: String) -> String {
            var text = value.replacingOccurrences(of: "\\", with: "\\\\")
            text = text.replacingOccurrences(of: "'", with: "\\'")
            text = text.replacingOccurrences(of: "\n", with: "\\n")
            text = text.replacingOccurrences(of: "\r", with: "\\r")
            return "'\(text)'"
        }

        func buildStorageScript(token: String?, user: User?) -> String {
            if let token = token, !token.isEmpty {
                var lines: [String] = [
                    "try {",
                    "localStorage.setItem('token', \(jsEscapedString(token)));"
                ]

                if let user = user,
                   let userData = try? JSONEncoder().encode(user),
                   let userJSON = String(data: userData, encoding: .utf8) {
                    lines.append("localStorage.setItem('user', \(jsEscapedString(userJSON)));")
                }

                lines.append("} catch (e) {}")
                return lines.joined(separator: "\n")
            }

            return "try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (e) {}"
        }

        func syncAuth(token: String?, user: User?) -> Bool {
            let newSignature = signature(token: token, user: user)
            let newScript = buildStorageScript(token: token, user: user)

            runtimeScript = newScript
            if newSignature == authSignature {
                return false
            }

            authSignature = newSignature

            guard let webView = webView else {
                return true
            }

            let controller = webView.configuration.userContentController
            controller.removeAllUserScripts()
            controller.addUserScript(WKUserScript(source: newScript, injectionTime: .atDocumentStart, forMainFrameOnly: false))

            return true
        }

        func injectRuntimeAuth() {
            webView?.evaluateJavaScript(runtimeScript, completionHandler: nil)
        }

        func load(route: String, force: Bool = false) {
            let normalizedRoute = normalize(route)
            if !force, normalizedRoute == currentRoute {
                return
            }

            guard let url = URL(string: baseURL + normalizedRoute) else {
                return
            }

            currentRoute = normalizedRoute
            let request = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 45)
            webView?.load(request)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            injectRuntimeAuth()
            let routeB64 = Data(currentRoute.utf8).base64EncodedString()
            let redirectScript = """
            try {
                var desired = atob('\(routeB64)');
                if (window.location.pathname === '/login' && localStorage.getItem('token')) {
                    window.location.replace(desired);
                }
            } catch (e) {}
            """
            webView.evaluateJavaScript(redirectScript, completionHandler: nil)
        }

        // Handle JS alert/confirm in WKWebView so dashboard actions using window.confirm work on iOS.
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            presentAlert(from: webView, title: nil, message: message, isConfirmation: false) { _ in
                completionHandler()
            }
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            presentAlert(from: webView, title: nil, message: message, isConfirmation: true, completion: completionHandler)
        }

        private func presentAlert(from webView: WKWebView, title: String?, message: String, isConfirmation: Bool, completion: @escaping (Bool) -> Void) {
            DispatchQueue.main.async {
                guard let root = self.topViewController(from: webView) else {
                    completion(false)
                    return
                }

                let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
                if isConfirmation {
                    alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completion(false) })
                    alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completion(true) })
                } else {
                    alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completion(true) })
                }
                root.present(alert, animated: true)
            }
        }

        private func topViewController(from webView: WKWebView) -> UIViewController? {
            if let vc = webView.closestViewController() {
                return topMost(from: vc)
            }
            if let root = webView.window?.rootViewController {
                return topMost(from: root)
            }
            guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }) else {
                return nil
            }
            let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
            return topMost(from: root)
        }

        private func topMost(from controller: UIViewController?) -> UIViewController? {
            if let nav = controller as? UINavigationController {
                return topMost(from: nav.visibleViewController)
            }
            if let tab = controller as? UITabBarController {
                return topMost(from: tab.selectedViewController)
            }
            if let presented = controller?.presentedViewController {
                return topMost(from: presented)
            }
            return controller
        }
    }
}

private extension UIView {
    func closestViewController() -> UIViewController? {
        var responder: UIResponder? = self
        while let current = responder {
            if let vc = current as? UIViewController {
                return vc
            }
            responder = current.next
        }
        return nil
    }
}

struct MoreHubView: View {
    @EnvironmentObject var auth: AuthManager

    var body: some View {
        NavigationStack {
            List {
                Section("Dashboard") {
                    if auth.canAccess(module: "overview") {
                        NavigationLink(destination: PortalModuleContainer(title: "Overview", route: "/overview")) {
                            Label("Overview", systemImage: "house")
                        }
                    }
                    if auth.canAccess(module: "analytics") {
                        NavigationLink(destination: PortalModuleContainer(title: "Analytics", route: "/analytics")) {
                            Label("Analytics", systemImage: "chart.bar")
                        }
                    }
                    if auth.canAccess(module: "planner") {
                        NavigationLink(destination: PortalModuleContainer(title: "Planner", route: "/planner")) {
                            Label("Planner", systemImage: "calendar")
                        }
                    }
                }
                if auth.canAccess(module: "employees") {
                    Section("Team") {
                        NavigationLink(destination: PortalModuleContainer(title: "Employees", route: "/employees")) {
                            Label("Employees", systemImage: "person.2")
                        }
                    }
                }
                Section("Account") {
                    NavigationLink(destination: ProfileView()) {
                        Label("Profile", systemImage: "person.circle")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("More")
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var showLogoutConfirm = false

    var user: User? { auth.currentUser }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(Color.brandIndigo.opacity(0.15))
                                .frame(width: 60, height: 60)
                            Text(String(user?.displayName.prefix(2).uppercased() ?? "??"))
                                .font(.system(size: 20, weight: .black))
                                .foregroundColor(Color.brandIndigo)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(user?.displayName ?? "User")
                                .font(.headline)
                                .fontWeight(.bold)
                            Text("@\(user?.username ?? "")")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            if let role = user?.role {
                                StatusBadge(text: role.capitalized, color: Color.brandIndigo)
                            }
                        }
                    }
                    .padding(.vertical, 6)

                    if let email = user?.email, !email.isEmpty {
                        HStack {
                            Label("Email", systemImage: "envelope")
                                .foregroundColor(.secondary)
                            Spacer()
                            Text(email)
                                .font(.subheadline)
                                .foregroundColor(.primary)
                        }
                    }
                }

                if let modules = user?.module_access, !modules.isEmpty {
                    Section("Module Access") {
                        ForEach(modules, id: \.self) { module in
                            HStack {
                                Image(systemName: moduleIcon(module))
                                    .foregroundColor(Color.brandIndigo)
                                    .frame(width: 20)
                                Text(module.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .font(.subheadline)
                            }
                        }
                    }
                } else if user?.isAdmin == true {
                    Section("Module Access") {
                        HStack {
                            Image(systemName: "star.fill")
                                .foregroundColor(colorForName("amber"))
                            Text("Full Admin Access")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                        }
                    }
                }

                Section("App Info") {
                    HStack {
                        Label("Backend", systemImage: "server.rack")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("Railway Cloud")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Label("Version", systemImage: "info.circle")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("1.1.0")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        showLogoutConfirm = true
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Sign Out")
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Sign Out", isPresented: $showLogoutConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Sign Out", role: .destructive) { auth.logout() }
            } message: { Text("Are you sure you want to sign out?") }
        }
    }

    private func moduleIcon(_ module: String) -> String {
        switch module.lowercased() {
        case "overview": return "house"
        case "tasks": return "checklist"
        case "departments": return "building.2"
        case "employees": return "person.2"
        case "analytics": return "chart.bar"
        case "field_visits": return "map"
        case "todos": return "list.bullet"
        case "planner": return "calendar"
        default: return "square.grid.2x2"
        }
    }
}
