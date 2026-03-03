import SwiftUI
import Charts

struct AnalyticsView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var analytics: TaskAnalytics? = nil
    @State private var isLoading = true
    @State private var errorMessage = ""

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    LoadingView(message: "Loading analytics...")
                } else if let data = analytics {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            // Summary Stats
                            summarySection(data)

                            // Status Breakdown Chart
                            if let summary = data.summary {
                                statusChartSection(summary)
                            }

                            // Department Health
                            if let health = data.health, !health.isEmpty {
                                deptHealthSection(health)
                            }

                            // Critical Bottlenecks
                            if let bottlenecks = data.critical_bottlenecks, !bottlenecks.isEmpty {
                                bottlenecksSection(bottlenecks)
                            }

                            // Highest Workload
                            if let workload = data.highest_workload, !workload.isEmpty {
                                workloadSection(workload)
                            }

                            // Agency Performance
                            if let agencies = data.agency_performance, !agencies.isEmpty {
                                agencySection(agencies)
                            }
                        }
                        .padding(.vertical, 16)
                        .padding(.bottom, 32)
                    }
                    .background(Color(.systemGroupedBackground))
                    .refreshable { await loadAnalytics() }
                } else {
                    EmptyStateView(icon: "chart.bar", title: "No Analytics", subtitle: "No data available yet.")
                }
            }
            .navigationTitle("Analytics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { Task { await loadAnalytics() } }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
        .task { await loadAnalytics() }
    }

    // MARK: - Summary Section
    @ViewBuilder
    private func summarySection(_ data: TaskAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Summary")
            if let summary = data.summary {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    StatCard(title: "Total Tasks", value: "\(summary.total ?? 0)", icon: "checklist", color: colorForName("indigo"))
                    StatCard(title: "Completed", value: "\(summary.completed ?? 0)", icon: "checkmark.circle", color: colorForName("emerald"))
                    StatCard(title: "Pending", value: "\(summary.pending ?? 0)", icon: "clock", color: colorForName("amber"))
                    StatCard(title: "Overdue", value: "\(summary.overdue ?? 0)", icon: "exclamationmark.triangle", color: colorForName("rose"))
                }
                .padding(.horizontal, 16)

                // Completion Rate
                if let total = summary.total, let completed = summary.completed, total > 0 {
                    let rate = Double(completed) / Double(total)
                    CardView {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("Completion Rate")
                                    .font(.subheadline)
                                    .fontWeight(.bold)
                                Spacer()
                                Text(String(format: "%.1f%%", rate * 100))
                                    .font(.title2)
                                    .fontWeight(.black)
                                    .foregroundColor(rate > 0.7 ? colorForName("emerald") : rate > 0.4 ? colorForName("amber") : colorForName("rose"))
                            }
                            ProgressView(value: rate)
                                .tint(rate > 0.7 ? colorForName("emerald") : rate > 0.4 ? colorForName("amber") : colorForName("rose"))
                                .scaleEffect(x: 1, y: 2)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
    }

    // MARK: - Status Chart
    @ViewBuilder
    private func statusChartSection(_ summary: AnalyticsSummary) -> some View {
        let chartData: [(String, Int, Color)] = [
            ("Completed", summary.completed ?? 0, colorForName("emerald")),
            ("Pending", summary.pending ?? 0, colorForName("amber")),
            ("Overdue", summary.overdue ?? 0, colorForName("rose")),
            ("In Progress", summary.in_progress ?? 0, colorForName("sky")),
        ].filter { $0.1 > 0 }

        if !chartData.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title: "Status Breakdown")
                CardView {
                    VStack(alignment: .leading, spacing: 12) {
                        if #available(iOS 16.0, *) {
                            Chart {
                                ForEach(chartData, id: \.0) { item in
                                    BarMark(
                                        x: .value("Count", item.1),
                                        y: .value("Status", item.0)
                                    )
                                    .foregroundStyle(item.2)
                                    .cornerRadius(6)
                                }
                            }
                            .frame(height: 140)
                        } else {
                            // Fallback for iOS 15
                            ForEach(chartData, id: \.0) { item in
                                let total = chartData.reduce(0) { $0 + $1.1 }
                                let ratio = total > 0 ? CGFloat(item.1) / CGFloat(total) : 0
                                HStack(spacing: 8) {
                                    Text(item.0)
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .frame(width: 70, alignment: .trailing)
                                    GeometryReader { geo in
                                        ZStack(alignment: .leading) {
                                            RoundedRectangle(cornerRadius: 4)
                                                .fill(Color(.tertiarySystemBackground))
                                            RoundedRectangle(cornerRadius: 4)
                                                .fill(item.2)
                                                .frame(width: geo.size.width * ratio)
                                        }
                                    }
                                    .frame(height: 20)
                                    Text("\(item.1)")
                                        .font(.caption)
                                        .fontWeight(.bold)
                                        .frame(width: 32, alignment: .trailing)
                                }
                            }
                            .padding(.vertical, 4)
                        }

                        // Legend
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                            ForEach(chartData, id: \.0) { item in
                                HStack(spacing: 6) {
                                    Circle().fill(item.2).frame(width: 8, height: 8)
                                    Text(item.0).font(.caption).foregroundColor(.secondary)
                                    Spacer()
                                    Text("\(item.1)").font(.caption).fontWeight(.bold)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: - Dept Health
    @ViewBuilder
    private func deptHealthSection(_ health: [DepartmentHealth]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Department Health", count: health.count)
            VStack(spacing: 8) {
                ForEach(health, id: \.department_id) { dept in
                    CardView {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(dept.department_name ?? "Unknown")
                                    .font(.subheadline)
                                    .fontWeight(.bold)
                                Spacer()
                                if let rate = dept.completion_rate {
                                    Text(String(format: "%.0f%%", rate * 100))
                                        .font(.subheadline)
                                        .fontWeight(.black)
                                        .foregroundColor(rate > 0.7 ? colorForName("emerald") : rate > 0.4 ? colorForName("amber") : colorForName("rose"))
                                }
                            }

                            if let rate = dept.completion_rate {
                                ProgressView(value: rate)
                                    .tint(rate > 0.7 ? colorForName("emerald") : rate > 0.4 ? colorForName("amber") : colorForName("rose"))
                            }

                            HStack(spacing: 12) {
                                if let total = dept.total {
                                    Text("\(total) total")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                if let overdue = dept.overdue, overdue > 0 {
                                    Text("\(overdue) overdue")
                                        .font(.caption)
                                        .foregroundColor(colorForName("rose"))
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Bottlenecks
    @ViewBuilder
    private func bottlenecksSection(_ tasks: [DashboardTask]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Critical Bottlenecks", count: tasks.count)
            VStack(spacing: 6) {
                ForEach(tasks) { task in
                    TaskRowCompact(task: task)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Workload
    @ViewBuilder
    private func workloadSection(_ workload: [EmployeeWorkload]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Highest Workload")
            VStack(spacing: 8) {
                ForEach(workload, id: \.employee_id) { item in
                    CardView {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(colorForName("violet").opacity(0.12))
                                    .frame(width: 40, height: 40)
                                Text(String(item.employee_name?.prefix(2).uppercased() ?? "??"))
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .foregroundColor(colorForName("violet"))
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.employee_name ?? "Unknown")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                HStack(spacing: 8) {
                                    Text("\(item.task_count ?? 0) tasks")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    if let overdue = item.overdue, overdue > 0 {
                                        Text("\(overdue) overdue")
                                            .font(.caption)
                                            .foregroundColor(colorForName("rose"))
                                    }
                                }
                            }
                            Spacer()
                            Text("\(item.task_count ?? 0)")
                                .font(.title3)
                                .fontWeight(.black)
                                .foregroundColor(colorForName("violet"))
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Agency Performance
    @ViewBuilder
    private func agencySection(_ agencies: [AgencyPerformance]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Agency Performance")
            VStack(spacing: 8) {
                ForEach(agencies, id: \.agency) { agency in
                    CardView {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(agency.agency ?? "Unknown")
                                    .font(.subheadline)
                                    .fontWeight(.bold)
                                Spacer()
                                if let rate = agency.completion_rate {
                                    Text(String(format: "%.0f%%", rate * 100))
                                        .font(.subheadline)
                                        .fontWeight(.black)
                                        .foregroundColor(rate > 0.7 ? colorForName("emerald") : rate > 0.4 ? colorForName("amber") : colorForName("rose"))
                                }
                            }
                            HStack(spacing: 12) {
                                if let total = agency.total { Text("\(total) total").font(.caption).foregroundColor(.secondary) }
                                if let completed = agency.completed { Text("\(completed) done").font(.caption).foregroundColor(colorForName("emerald")) }
                                if let overdue = agency.overdue, overdue > 0 { Text("\(overdue) overdue").font(.caption).foregroundColor(colorForName("rose")) }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func loadAnalytics() async {
        await MainActor.run { isLoading = true }
        do {
            let data = try await APIService.shared.getTaskAnalytics()
            await MainActor.run { analytics = data; isLoading = false }
        } catch APIError.unauthorized {
            await MainActor.run { auth.logout() }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription; isLoading = false }
        }
    }
}
