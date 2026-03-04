import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var username = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var hint = ""
    @State private var showForgotPassword = false
    @State private var forgotEmail = ""
    @State private var forgotMessage = ""
    @State private var isForgotLoading = false
    @State private var showServerSettings = false
    @State private var serverURL = APIService.shared.baseURL

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    // Branding Header
                    ZStack {
                        LinearGradient(
                            colors: [Color(red: 0.10, green: 0.10, blue: 0.55), Color(red: 0.33, green: 0.10, blue: 0.70)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )

                        VStack(spacing: 16) {
                            Spacer(minLength: 60)
                            // Logo
                            VStack(spacing: 8) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 16)
                                        .fill(Color.white.opacity(0.2))
                                        .frame(width: 64, height: 64)
                                    Text("DA")
                                        .font(.system(size: 24, weight: .black, design: .rounded))
                                        .foregroundColor(.white)
                                }
                                Text("District Administration")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white.opacity(0.8))
                                    .textCase(.uppercase)
                                    .tracking(1)
                            }

                            VStack(spacing: 8) {
                                Text("Task\nDashboard")
                                    .font(.system(size: 38, weight: .black, design: .rounded))
                                    .foregroundColor(.white)
                                    .multilineTextAlignment(.center)
                                    .lineSpacing(4)

                                Rectangle()
                                    .fill(Color.purple.opacity(0.7))
                                    .frame(width: 48, height: 3)
                                    .clipShape(Capsule())

                                Text("Centralized task monitoring &\nmanagement portal")
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.75))
                                    .multilineTextAlignment(.center)
                            }

                            // Date
                            HStack(spacing: 10) {
                                Image(systemName: "calendar")
                                    .foregroundColor(.white.opacity(0.8))
                                Text(todayFormatted())
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(.white.opacity(0.9))
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(Color.white.opacity(0.15))
                            .clipShape(Capsule())

                            Spacer(minLength: 40)
                        }
                        .padding(.horizontal, 32)
                    }
                    .frame(height: geo.size.height * 0.44)

                    // Login Form
                    VStack(spacing: 24) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(showForgotPassword ? "Reset Password" : "Welcome Back")
                                .font(.system(size: 28, weight: .black, design: .rounded))
                            Text(showForgotPassword ? "Enter your email to receive a reset link." : "Please sign in to continue.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        if showForgotPassword {
                            forgotPasswordForm
                        } else {
                            loginForm
                        }
                    }
                    .padding(28)
                    .background(Color(.systemBackground))
                }
            }
            .ignoresSafeArea(edges: .top)
        }
    }

    // MARK: - Login Form
    private var loginForm: some View {
        VStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Username")
                    .font(.caption)
                    .fontWeight(.black)
                    .textCase(.uppercase)
                    .tracking(0.5)
                    .foregroundColor(.secondary)
                HStack(spacing: 10) {
                    Image(systemName: "person.fill")
                        .foregroundColor(.secondary)
                    TextField("Enter username", text: $username)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .textContentType(.username)
                }
                .padding(14)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.brandIndigo.opacity(0.3), lineWidth: 1))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Password")
                    .font(.caption)
                    .fontWeight(.black)
                    .textCase(.uppercase)
                    .tracking(0.5)
                    .foregroundColor(.secondary)
                HStack(spacing: 10) {
                    Image(systemName: "lock.fill")
                        .foregroundColor(.secondary)
                    SecureField("••••••••", text: $password)
                        .textContentType(.password)
                }
                .padding(14)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.brandIndigo.opacity(0.3), lineWidth: 1))

                HStack {
                    Button("Need a hint?") {
                        Task { await fetchHint() }
                    }
                    .font(.caption)
                    .foregroundColor(.brandIndigo)
                    Spacer()
                    Button("Forgot Password?") {
                        withAnimation { showForgotPassword = true }
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
                .padding(.top, 2)

                if !hint.isEmpty {
                    Text("Hint: \(hint)")
                        .font(.caption)
                        .foregroundColor(Color(red: 0.75, green: 0.45, blue: 0.0))
                        .padding(8)
                        .background(Color(red: 1.0, green: 0.95, blue: 0.8))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            if !errorMessage.isEmpty {
                ErrorBanner(message: errorMessage, onDismiss: clearErrorMessage)
            }

            Button(action: { Task { await handleLogin() } }) {
                Group {
                    if isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Text("Sign In")
                            .font(.headline)
                            .fontWeight(.bold)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(LinearGradient(colors: [Color.brandIndigo, Color.brandViolet], startPoint: .leading, endPoint: .trailing))
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: Color.brandIndigo.opacity(0.35), radius: 8, x: 0, y: 4)
            }
            .disabled(isLoading || username.isEmpty || password.isEmpty)
            .opacity((username.isEmpty || password.isEmpty) ? 0.6 : 1.0)

            VStack(spacing: 6) {
                Button(showServerSettings ? "Hide Server Settings" : "Server Settings") {
                    withAnimation { showServerSettings.toggle() }
                }
                .font(.caption)
                .foregroundColor(.secondary)

                if showServerSettings {
                    TextField("https://your-server-url", text: $serverURL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .font(.caption)
                        .padding(10)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10))

                    HStack(spacing: 8) {
                        Button("Use Default") {
                            serverURL = APIService.defaultBaseURL
                            APIService.shared.setBaseURL(APIService.defaultBaseURL)
                        }
                        .font(.caption)

                        Button("Save Server") {
                            APIService.shared.setBaseURL(serverURL)
                            serverURL = APIService.shared.baseURL
                        }
                        .font(.caption)
                        .fontWeight(.semibold)
                    }
                }
            }
        }
    }

    // MARK: - Forgot Password
    private var forgotPasswordForm: some View {
        VStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Email Address")
                    .font(.caption)
                    .fontWeight(.black)
                    .textCase(.uppercase)
                    .tracking(0.5)
                    .foregroundColor(.secondary)
                HStack(spacing: 10) {
                    Image(systemName: "envelope.fill")
                        .foregroundColor(.secondary)
                    TextField("admin@example.com", text: $forgotEmail)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
                .padding(14)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.brandIndigo.opacity(0.3), lineWidth: 1))
            }

            if !forgotMessage.isEmpty {
                Text(forgotMessage)
                    .font(.subheadline)
                    .foregroundColor(colorForName("emerald"))
                    .padding(10)
                    .background(colorForName("emerald").opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            Button(action: { Task { await handleForgotPassword() } }) {
                Group {
                    if isForgotLoading {
                        ProgressView().tint(.white)
                    } else {
                        Text("Send Reset Link")
                            .font(.headline)
                            .fontWeight(.bold)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color.brandIndigo)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .disabled(isForgotLoading || forgotEmail.isEmpty)

            Button("Back to Login") {
                withAnimation { showForgotPassword = false; forgotMessage = "" }
            }
            .font(.subheadline)
            .foregroundColor(.secondary)
        }
    }

    // MARK: - Actions
    private func clearErrorMessage() {
        errorMessage = ""
    }

    private func parsedBackendMessage(_ raw: String) -> String {
        guard let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let detail = obj["detail"] as? String,
              !detail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return raw
        }
        return detail
    }
    
    private func handleLogin() async {
        isLoading = true
        errorMessage = ""
        hint = ""
        do {
            let response = try await APIService.shared.login(username: username, password: password)
            await MainActor.run {
                auth.login(user: response.user, token: response.access_token)
            }
        } catch {
            await MainActor.run {
                if let apiError = error as? APIError {
                    switch apiError {
                    case .serverError(_, let message):
                        let detail = parsedBackendMessage(message)
                        errorMessage = detail.isEmpty ? "Login failed. Please try again." : detail
                    case .unauthorized:
                        errorMessage = "Session expired. Please log in again."
                    default:
                        errorMessage = apiError.errorDescription ?? "Login failed. Please try again."
                    }
                } else {
                    errorMessage = error.localizedDescription
                }
                isLoading = false
            }
            return
        }
        await MainActor.run { isLoading = false }
    }

    private func fetchHint() async {
        guard !username.isEmpty else { return }
        do {
            let response = try await APIService.shared.getHint(username: username)
            await MainActor.run { hint = response.hint ?? "No hint available." }
        } catch {
            await MainActor.run { hint = "No hint available." }
        }
    }

    private func handleForgotPassword() async {
        isForgotLoading = true
        do {
            try await APIService.shared.forgotPassword(email: forgotEmail)
            await MainActor.run {
                forgotMessage = "If registered, a reset link has been sent to your email."
                isForgotLoading = false
            }
        } catch {
            await MainActor.run {
                forgotMessage = "Error sending link. Please try again."
                isForgotLoading = false
            }
        }
    }

    private func todayFormatted() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d, yyyy"
        return formatter.string(from: Date())
    }
}
