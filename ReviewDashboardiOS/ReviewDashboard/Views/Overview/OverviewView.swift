import SwiftUI

struct OverviewView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var tasks: [DashboardTask] = []
    @State private var departments: [Department] = []
    @State private var employees: [Employee] = []
    @State private var todos: [Todo] = []
    @State private var fieldVisits: [FieldVisit] = []
    @State private var isLoading = true
    @State private var errorMessage = ""

    private var totalTasks: Int { tasks.count }
    private var pendingTasks: Int { tasks.filter { $0.status?.lowercased() == "pending" }.count }
    private var overdueTasks: Int { tasks.filter { $0.status?.lowercased() == "overdue" }.count }
    private var completedTasks: Int { tasks.filter { $0.status?.lowercased() == "completed" }.count }

    private var todayTasks: [DashboardTask] {
        tasks.filter { $0.is_today == true || $0.status?.lowercased() == "overdue" }
            .sorted { ($0.is_pinned ?? false) && !($1.is_pinned ?? false) }
    }

    private var upcomingDepts: [Department] {
        departments
            .filter { ($0.review_health?.days_since_last_review ?? 999) > 30 }
            .prefix(5)
            .map { $0 }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Welcome Header
                    welcomeHeader

                    if isLoading {
                        LoadingView()
                            .frame(height: 200)
                    } else {
                        // Stats Grid
                        statsSection

                        // Today's Focus
                        if !todayTasks.isEmpty {
                            todaySection
                        }

                        // Departments needing review
                        if !upcomingDepts.isEmpty {
                            needsReviewSection
                        }

                        // Quick module access
                        quickAccessSection
                    }
                }
                .padding(.bottom, 32)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Overview")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { Task { await loadData() } }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .refreshable {
                await loadData()
            }
        }
        .task {
            await loadData()
        }
    }

    // MARK: - Welcome Header
    private var welcomeHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Good \(greetingTime())")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Text(auth.currentUser?.displayName ?? "User")
                .font(.system(size: 26, weight: .black, design: .rounded))
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Stats Section
    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Dashboard")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                StatCard(title: "Total Tasks", value: "\(totalTasks)", icon: "checklist", color: colorForName("indigo"))
                StatCard(title: "Pending", value: "\(pendingTasks)", icon: "clock", color: colorForName("amber"))
                StatCard(title: "Overdue", value: "\(overdueTasks)", icon: "exclamationmark.triangle", color: colorForName("rose"))
                StatCard(title: "Completed", value: "\(completedTasks)", icon: "checkmark.circle", color: colorForName("emerald"))
                StatCard(title: "Departments", value: "\(departments.count)", icon: "building.2", color: colorForName("sky"))
                StatCard(title: "Employees", value: "\(employees.count)", icon: "person.2", color: colorForName("violet"))
                StatCard(title: "Field Visits", value: "\(fieldVisits.count)", icon: "map", color: colorForName("teal"))
                StatCard(title: "Todos", value: "\(todos.count)", icon: "list.bullet", color: colorForName("orange"))
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Today Section
    private var todaySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Today's Focus", count: todayTasks.count)
            VStack(spacing: 8) {
                ForEach(todayTasks.prefix(5)) { task in
                    TaskRowCompact(task: task)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Needs Review Section
    private var needsReviewSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Departments Needing Review")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(upcomingDepts) { dept in
                        DeptReviewCard(dept: dept)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: - Quick Access
    private var quickAccessSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Quick Access")
            VStack(spacing: 1) {
                ForEach(quickModules, id: \.0) { item in
                    if auth.canAccess(module: item.2) {
                        NavigationLink(destination: item.3) {
                            HStack(spacing: 14) {
                                Image(systemName: item.1)
                                    .font(.system(size: 18))
                                    .foregroundColor(item.4)
                                    .frame(width: 32)
                                Text(item.0)
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.primary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .background(Color(.systemBackground))
                        }
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 16)
            .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
        }
    }

    private var quickModules: [(String, String, String, AnyView, Color)] {
        [
            ("Tasks", "checklist", "tasks", AnyView(TasksView()), colorForName("indigo")),
            ("Departments", "building.2", "departments", AnyView(DepartmentsView()), colorForName("sky")),
            ("Employees", "person.2", "employees", AnyView(EmployeesView()), colorForName("violet")),
            ("Analytics", "chart.bar", "analytics", AnyView(AnalyticsView()), colorForName("emerald")),
            ("Field Visits", "map", "field_visits", AnyView(FieldVisitsView()), colorForName("teal")),
            ("To-Do List", "list.bullet", "todos", AnyView(TodosView()), colorForName("orange")),
        ]
    }

    // MARK: - Data Loading
    private func loadData() async {
        await MainActor.run { isLoading = true; errorMessage = "" }
        async let tasksResult = APIService.shared.getTasks()
        async let deptsResult = APIService.shared.getDepartments()
        async let empsResult = APIService.shared.getEmployees()
        do {
            let (t, d, e) = try await (tasksResult, deptsResult, empsResult)
            await MainActor.run {
                tasks = t
                departments = d
                employees = e
                isLoading = false
            }
        } catch APIError.unauthorized {
            await MainActor.run { auth.logout() }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
        // Non-critical extras
        if let t = try? await APIService.shared.getTodos() {
            await MainActor.run { todos = t }
        }
        if let fv = try? await APIService.shared.getFieldVisits() {
            await MainActor.run { fieldVisits = fv }
        }
    }

    private func greetingTime() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Morning" }
        if hour < 17 { return "Afternoon" }
        return "Evening"
    }
}

// MARK: - Task Row Compact
struct TaskRowCompact: View {
    let task: DashboardTask

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(statusColor(task.status))
                .frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(task.description)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let agency = task.assigned_agency, !agency.isEmpty {
                        Text(agency)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    if let deadline = task.deadline_date {
                        Text("·")
                            .foregroundColor(.secondary)
                        Text(formatDate(deadline))
                            .font(.caption)
                            .foregroundColor(isOverdue(deadline) ? colorForName("rose") : .secondary)
                    }
                }
            }
            Spacer()
            if let priority = task.priority {
                PriorityBadge(priority: priority)
            }
        }
        .padding(12)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 1)
    }
}

// MARK: - Dept Review Card
struct DeptReviewCard: View {
    let dept: Department

    var days: Int { dept.review_health?.days_since_last_review ?? 999 }
    var urgencyColor: Color {
        if days > 90 { return colorForName("rose") }
        if days > 60 { return colorForName("amber") }
        return colorForName("sky")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Circle()
                    .fill(colorForName(dept.color ?? "indigo"))
                    .frame(width: 8, height: 8)
                Text(dept.name)
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .lineLimit(1)
            }
            Text(days == 999 ? "Never reviewed" : "\(days) days ago")
                .font(.caption)
                .foregroundColor(urgencyColor)
                .fontWeight(.semibold)
        }
        .padding(14)
        .frame(width: 150)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(0.05), radius: 6, x: 0, y: 2)
    }
}
