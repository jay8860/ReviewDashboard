import SwiftUI

struct DepartmentsView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var departments: [Department] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var searchText = ""
    @State private var showAddDept = false
    @State private var selectedDept: Department? = nil
    @State private var deptToDelete: Department? = nil
    @State private var showDeleteConfirm = false
    @State private var viewMode: ViewMode = .grid

    enum ViewMode { case grid, list }

    var groupedDepts: [(String, [Department])] {
        let filtered = departments.filter { dept in
            searchText.isEmpty || dept.name.localizedCaseInsensitiveContains(searchText)
        }
        let groups = Dictionary(grouping: filtered) { $0.category_name ?? "General" }
        return groups.sorted { $0.key < $1.key }.map { ($0.key, $0.value) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    LoadingView(message: "Loading departments...")
                } else if departments.isEmpty {
                    EmptyStateView(
                        icon: "building.2",
                        title: "No Departments",
                        subtitle: "Add your first department to get started.",
                        action: auth.isAdmin ? { showAddDept = true } : nil,
                        actionLabel: "Add Department"
                    )
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            SearchBar(text: $searchText, placeholder: "Search departments...")
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)

                            if groupedDepts.isEmpty {
                                EmptyStateView(icon: "magnifyingglass", title: "No Results", subtitle: "Try a different search term.")
                            } else {
                                ForEach(groupedDepts, id: \.0) { (category, depts) in
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack {
                                            Text(category)
                                                .font(.caption)
                                                .fontWeight(.black)
                                                .textCase(.uppercase)
                                                .tracking(0.8)
                                                .foregroundColor(.secondary)
                                            Spacer()
                                            Text("\(depts.count)")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                        .padding(.horizontal, 16)
                                        .padding(.top, 16)
                                        .padding(.bottom, 4)

                                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                                            ForEach(depts) { dept in
                                                NavigationLink(destination: DepartmentDetailView(departmentId: dept.id)) {
                                                    DeptCard(dept: dept, onEdit: auth.isAdmin ? {
                                                        selectedDept = dept
                                                    } : nil, onDelete: auth.isAdmin ? {
                                                        deptToDelete = dept
                                                        showDeleteConfirm = true
                                                    } : nil)
                                                }
                                                .buttonStyle(.plain)
                                            }
                                        }
                                        .padding(.horizontal, 16)
                                    }
                                }
                                .padding(.bottom, 32)
                            }
                        }
                    }
                    .background(Color(.systemGroupedBackground))
                    .refreshable { await loadDepartments() }
                }
            }
            .navigationTitle("Departments")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { Task { await loadDepartments() } }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showAddDept = true }) {
                        Image(systemName: "plus").fontWeight(.semibold)
                    }
                    .opacity(auth.isAdmin ? 1 : 0)
                    .disabled(!auth.isAdmin)
                }
            }
            .sheet(isPresented: $showAddDept) {
                DeptFormView(dept: nil) { name, desc, color, cat, priority in
                    await createDept(name: name, description: desc, color: color, category: cat, priority: priority)
                    showAddDept = false
                }
            }
            .sheet(item: $selectedDept) { dept in
                DeptFormView(dept: dept) { name, desc, color, cat, priority in
                    await updateDept(id: dept.id, name: name, description: desc, color: color, category: cat, priority: priority)
                    selectedDept = nil
                }
            }
            .alert("Delete Department", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    if let d = deptToDelete { Task { await deleteDept(id: d.id) } }
                }
            } message: {
                Text("Are you sure? This will permanently delete the department.")
            }
        }
        .task { await loadDepartments() }
    }

    private func loadDepartments() async {
        await MainActor.run { isLoading = true }
        do {
            let depts = try await APIService.shared.getDepartments()
            await MainActor.run { departments = depts; isLoading = false }
        } catch APIError.unauthorized {
            await MainActor.run { auth.logout() }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription; isLoading = false }
        }
    }

    private func createDept(name: String, description: String?, color: String?, category: String?, priority: String?) async {
        do {
            let dept = try await APIService.shared.createDepartment(name: name, description: description, color: color, categoryName: category, priorityLevel: priority)
            await MainActor.run { departments.append(dept) }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func updateDept(id: Int, name: String, description: String?, color: String?, category: String?, priority: String?) async {
        do {
            let dept = try await APIService.shared.updateDepartment(id: id, name: name, description: description, color: color, categoryName: category, priorityLevel: priority)
            await MainActor.run { if let idx = departments.firstIndex(where: { $0.id == id }) { departments[idx] = dept } }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func deleteDept(id: Int) async {
        do {
            try await APIService.shared.deleteDepartment(id: id)
            await MainActor.run { departments.removeAll { $0.id == id } }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }
}

// MARK: - Dept Card
struct DeptCard: View {
    let dept: Department
    let onEdit: (() -> Void)?
    let onDelete: (() -> Void)?

    var reviewDays: Int? { dept.review_health?.days_since_last_review }
    var reviewStatus: String {
        guard let d = reviewDays else { return "Never reviewed" }
        if d == 0 { return "Reviewed today" }
        if d == 1 { return "1 day ago" }
        return "\(d) days ago"
    }
    var reviewColor: Color {
        guard let d = reviewDays else { return colorForName("rose") }
        if d > 90 { return colorForName("rose") }
        if d > 30 { return colorForName("amber") }
        return colorForName("emerald")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(colorForName(dept.color ?? "indigo").opacity(0.15))
                        .frame(width: 36, height: 36)
                    Image(systemName: "building.2.fill")
                        .font(.system(size: 16))
                        .foregroundColor(colorForName(dept.color ?? "indigo"))
                }
                Spacer()
                if onEdit != nil || onDelete != nil {
                    Menu {
                        if let edit = onEdit { Button("Edit", action: edit) }
                        if let del = onDelete { Button("Delete", role: .destructive, action: del) }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                    }
                }
            }

            Text(dept.name)
                .font(.subheadline)
                .fontWeight(.bold)
                .lineLimit(2)
                .foregroundColor(.primary)

            if let pending = dept.pending_tasks, let total = dept.total_tasks {
                Text("\(pending)/\(total) pending")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 4) {
                Circle().fill(reviewColor).frame(width: 6, height: 6)
                Text(reviewStatus)
                    .font(.caption2)
                    .foregroundColor(reviewColor)
            }

            if let priority = dept.priority_level {
                PriorityBadge(priority: priority)
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.05), radius: 6, x: 0, y: 2)
    }
}

// MARK: - Dept Form View
struct DeptFormView: View {
    let dept: Department?
    let onSave: (String, String?, String?, String?, String?) async -> Void

    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var selectedColor = "indigo"
    @State private var categoryName = ""
    @State private var priorityLevel = "Normal"
    @State private var isSaving = false

    let colors = ["indigo", "emerald", "amber", "rose", "sky", "violet", "teal", "orange"]
    let priorities = ["Critical", "High", "Normal", "Low"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Department Info") {
                    TextField("Name *", text: $name)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("Category (e.g. Finance, HR)", text: $categoryName)
                }
                Section("Appearance") {
                    Picker("Color", selection: $selectedColor) {
                        ForEach(colors, id: \.self) { c in
                            HStack {
                                Circle().fill(colorForName(c)).frame(width: 14, height: 14)
                                Text(c.capitalized)
                            }.tag(c)
                        }
                    }
                    .pickerStyle(.menu)
                }
                Section("Priority") {
                    Picker("Priority Level", selection: $priorityLevel) {
                        ForEach(priorities, id: \.self) { Text($0) }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle(dept == nil ? "New Department" : "Edit Department")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { Task { await save() } }) {
                        if isSaving { ProgressView().scaleEffect(0.8) }
                        else { Text("Save").fontWeight(.semibold) }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
            .onAppear { prefill() }
        }
    }

    private func prefill() {
        guard let d = dept else { return }
        name = d.name
        description = d.description ?? ""
        selectedColor = d.color ?? "indigo"
        categoryName = d.category_name ?? ""
        priorityLevel = d.priority_level ?? "Normal"
    }

    private func save() async {
        isSaving = true
        await onSave(
            name.trimmingCharacters(in: .whitespaces),
            description.isEmpty ? nil : description,
            selectedColor,
            categoryName.isEmpty ? nil : categoryName,
            priorityLevel
        )
        isSaving = false
    }
}

// MARK: - Department Detail View
struct DepartmentDetailView: View {
    let departmentId: Int
    @EnvironmentObject var auth: AuthManager
    @State private var department: Department? = nil
    @State private var tasks: [DashboardTask] = []
    @State private var reviews: [ReviewSession] = []
    @State private var isLoading = true
    @State private var errorMessage = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if isLoading {
                    LoadingView().frame(height: 300)
                } else if let dept = department {
                    // Header
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 16)
                                    .fill(colorForName(dept.color ?? "indigo").opacity(0.15))
                                    .frame(width: 52, height: 52)
                                Image(systemName: "building.2.fill")
                                    .font(.system(size: 22))
                                    .foregroundColor(colorForName(dept.color ?? "indigo"))
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text(dept.name)
                                    .font(.title2)
                                    .fontWeight(.black)
                                if let cat = dept.category_name {
                                    Text(cat)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .textCase(.uppercase)
                                        .tracking(0.5)
                                }
                            }
                        }
                        if let desc = dept.description, !desc.isEmpty {
                            Text(desc)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.horizontal, 16)

                    // Stats
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        StatCard(title: "Total Tasks", value: "\(dept.total_tasks ?? tasks.count)", icon: "checklist", color: colorForName("indigo"))
                        StatCard(title: "Pending", value: "\(dept.pending_tasks ?? 0)", icon: "clock", color: colorForName("amber"))
                        StatCard(title: "Overdue", value: "\(dept.overdue_tasks ?? 0)", icon: "exclamationmark.triangle", color: colorForName("rose"))
                        StatCard(title: "Completed", value: "\(dept.completed_tasks ?? 0)", icon: "checkmark.circle", color: colorForName("emerald"))
                    }
                    .padding(.horizontal, 16)

                    // Review Health
                    if let health = dept.review_health {
                        CardView {
                            VStack(alignment: .leading, spacing: 10) {
                                Label("Review Health", systemImage: "heart.circle")
                                    .font(.headline)
                                    .fontWeight(.bold)
                                HStack(spacing: 16) {
                                    VStack(alignment: .leading) {
                                        Text(health.days_since_last_review.map { "\($0) days" } ?? "Never")
                                            .font(.title2)
                                            .fontWeight(.black)
                                        Text("Since last review")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    if let total = health.total_reviews {
                                        VStack(alignment: .leading) {
                                            Text("\(total)")
                                                .font(.title2)
                                                .fontWeight(.black)
                                            Text("Total reviews")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }

                    // Tasks
                    if !tasks.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionHeader(title: "Tasks", count: tasks.count)
                            ForEach(tasks.prefix(10)) { task in
                                TaskRowCompact(task: task)
                            }
                            .padding(.horizontal, 16)
                        }
                    }

                    // Recent Reviews
                    if !reviews.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionHeader(title: "Recent Reviews", count: reviews.count)
                            ForEach(reviews.prefix(5)) { review in
                                CardView {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(formatDate(review.review_date))
                                                .font(.subheadline)
                                                .fontWeight(.semibold)
                                            if let notes = review.notes, !notes.isEmpty {
                                                Text(notes)
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                                    .lineLimit(2)
                                            }
                                        }
                                        Spacer()
                                        if let status = review.status {
                                            StatusBadge(text: status, color: statusColor(status))
                                        }
                                    }
                                }
                                .padding(.horizontal, 16)
                            }
                        }
                    }
                }
            }
            .padding(.vertical, 16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(department?.name ?? "Department")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadData() }
    }

    private func loadData() async {
        await MainActor.run { isLoading = true }
        async let deptResult = APIService.shared.getDepartment(id: departmentId)
        async let tasksResult = APIService.shared.getTasks(departmentId: departmentId)
        async let reviewsResult = APIService.shared.getReviews(departmentId: departmentId)
        do {
            let (d, t, r) = try await (deptResult, tasksResult, reviewsResult)
            await MainActor.run { department = d; tasks = t; reviews = r; isLoading = false }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription; isLoading = false }
        }
    }
}
