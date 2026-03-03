import SwiftUI

// MARK: - Color Helpers
extension Color {
    static let brandIndigo = Color(red: 0.28, green: 0.24, blue: 0.80)
    static let brandViolet = Color(red: 0.49, green: 0.23, blue: 0.93)
    static let cardBackground = Color(.systemBackground)
    static let subtleBackground = Color(.secondarySystemBackground)
}

func colorForName(_ name: String) -> Color {
    switch name.lowercased() {
    case "indigo": return Color(red: 0.39, green: 0.40, blue: 0.95)
    case "emerald": return Color(red: 0.06, green: 0.73, blue: 0.51)
    case "amber": return Color(red: 0.96, green: 0.69, blue: 0.14)
    case "rose": return Color(red: 0.96, green: 0.27, blue: 0.40)
    case "sky": return Color(red: 0.14, green: 0.73, blue: 0.96)
    case "violet": return Color(red: 0.55, green: 0.27, blue: 0.98)
    case "teal": return Color(red: 0.13, green: 0.70, blue: 0.67)
    case "orange": return Color(red: 0.98, green: 0.45, blue: 0.09)
    default: return Color(red: 0.39, green: 0.40, blue: 0.95)
    }
}

func statusColor(_ status: String?) -> Color {
    switch status?.lowercased() {
    case "completed": return colorForName("emerald")
    case "overdue": return colorForName("rose")
    case "pending": return colorForName("amber")
    case "in_progress", "in progress": return colorForName("sky")
    default: return colorForName("indigo")
    }
}

func priorityColor(_ priority: String?) -> Color {
    switch priority?.lowercased() {
    case "critical": return colorForName("rose")
    case "high": return colorForName("orange")
    case "low": return colorForName("sky")
    default: return colorForName("indigo")
    }
}

// MARK: - Stat Card
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(color)
                Spacer()
            }
            Text(value)
                .font(.system(size: 28, weight: .black, design: .rounded))
                .foregroundColor(.primary)
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
                .textCase(.uppercase)
                .tracking(0.5)
            if let sub = subtitle {
                Text(sub)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.06), radius: 8, x: 0, y: 2)
    }
}

// MARK: - Status Badge
struct StatusBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2)
            .fontWeight(.bold)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12))
            .foregroundColor(color)
            .clipShape(Capsule())
    }
}

// MARK: - Priority Badge
struct PriorityBadge: View {
    let priority: String

    var body: some View {
        StatusBadge(text: priority, color: priorityColor(priority))
    }
}

// MARK: - Loading View
struct LoadingView: View {
    var message: String = "Loading..."

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.3)
            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Empty State View
struct EmptyStateView: View {
    let icon: String
    let title: String
    let subtitle: String
    var action: (() -> Void)? = nil
    var actionLabel: String = "Add New"

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 52))
                .foregroundColor(.secondary.opacity(0.5))
            VStack(spacing: 6) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.bold)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            if let action = action {
                Button(action: action) {
                    Label(actionLabel, systemImage: "plus")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.brandIndigo)
                        .foregroundColor(.white)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Error Banner
struct ErrorBanner: View {
    let message: String
    var onDismiss: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(colorForName("rose"))
            Text(message)
                .font(.subheadline)
                .foregroundColor(.primary)
            Spacer()
            if let dismiss = onDismiss {
                Button(action: dismiss) {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(12)
        .background(colorForName("rose").opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(colorForName("rose").opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - Card Container
struct CardView<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(16)
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.black.opacity(0.05), radius: 6, x: 0, y: 2)
    }
}

// MARK: - Section Header
struct SectionHeader: View {
    let title: String
    var count: Int? = nil
    var action: (() -> Void)? = nil
    var actionIcon: String = "plus"

    var body: some View {
        HStack {
            Text(title)
                .font(.headline)
                .fontWeight(.black)
                .foregroundColor(.primary)
            if let count = count {
                Text("\(count)")
                    .font(.caption)
                    .fontWeight(.bold)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Color.brandIndigo.opacity(0.1))
                    .foregroundColor(.brandIndigo)
                    .clipShape(Capsule())
            }
            Spacer()
            if let action = action {
                Button(action: action) {
                    Image(systemName: actionIcon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.brandIndigo)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

// MARK: - Refreshable Scroll
struct PullToRefreshView: View {
    var body: some View {
        EmptyView()
    }
}

// MARK: - Date Formatting
func formatDate(_ dateString: String?) -> String {
    guard let ds = dateString else { return "—" }
    let formats = ["yyyy-MM-dd'T'HH:mm:ss.SSSSSS", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd"]
    let formatter = DateFormatter()
    for fmt in formats {
        formatter.dateFormat = fmt
        if let date = formatter.date(from: ds) {
            formatter.dateFormat = "d MMM yyyy"
            return formatter.string(from: date)
        }
    }
    return ds
}

func formatDateTime(_ dateString: String?) -> String {
    guard let ds = dateString else { return "—" }
    let formats = ["yyyy-MM-dd'T'HH:mm:ss.SSSSSS", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd"]
    let formatter = DateFormatter()
    for fmt in formats {
        formatter.dateFormat = fmt
        if let date = formatter.date(from: ds) {
            formatter.dateFormat = "d MMM yyyy, h:mm a"
            return formatter.string(from: date)
        }
    }
    return ds
}

func isOverdue(_ dateString: String?) -> Bool {
    guard let ds = dateString else { return false }
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    guard let date = formatter.date(from: ds) else { return false }
    return date < Date()
}

// MARK: - Search Bar
struct SearchBar: View {
    @Binding var text: String
    var placeholder: String = "Search..."

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
            TextField(placeholder, text: $text)
                .autocorrectionDisabled()
            if !text.isEmpty {
                Button(action: { text = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(10)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Chip/Filter Button
struct FilterChip: View {
    let label: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption)
                .fontWeight(.semibold)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isActive ? Color.brandIndigo : Color(.secondarySystemBackground))
                .foregroundColor(isActive ? .white : .primary)
                .clipShape(Capsule())
        }
    }
}
