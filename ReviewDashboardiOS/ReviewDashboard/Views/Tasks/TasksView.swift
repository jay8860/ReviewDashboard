import SwiftUI

struct TasksView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var tasks: [DashboardTask] = []
    @State private var departments: [Department] = []
    @State private var employees: [Employee] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var searchText = ""
    @State private var selectedStatus: String? = nil
    @State private var selectedPriority: String? = nil
    @State private var showAddTask = false
    @State private var selectedTask: DashboardTask? = nil
    @State private var showEditTask = false
    @State private var taskToDelete: DashboardTask? = nil
    @State private var showDeleteConfirm = false

    let statusOptions = ["All", "Pending", "Completed", "Overdue"]
    let priorityOptions = ["All", "Critical", "High", "Normal", "Low"]

    var filteredTasks: [DashboardTask] {
        tasks.filter { task in
            let matchesSearch = searchText.isEmpty ||
                task.description.localizedCaseInsensitiveContains(searchText) ||
                (task.assigned_agency?.localizedCaseInsensitiveContains(searchText) ?? false)
            let matchesStatus = selectedStatus == nil || task.status == selectedStatus
            let matchesPriority = selectedPriority == nil || task.priority == selectedPriority
            return matchesSearch && matchesStatus && matchesPriority
        }
        .sorted { t1, t2 in
            let p1 = t1.is_pinned ?? false
            let p2 = t2.is_pinned ?? false
            if p1 != p2 { return p1 }
            return (t1.deadline_date ?? "") < (t2.deadline_date ?? "")
        }
    }

    var taskCounts: [String: Int] {
        var counts: [String: Int] = ["Pending": 0, "Completed": 0, "Overdue": 0]
        for task in tasks {
            if let s = task.status { counts[s, default: 0] += 1 }
        }
        return counts
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Stats row
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        TaskStatPill(icon: "checklist", label: "Total", value: tasks.count, color: .brandIndigo, isActive: selectedStatus == nil) {
                            selectedStatus = nil
                        }
                        TaskStatPill(icon: "clock", label: "Pending", value: taskCounts["Pending"] ?? 0, color: colorForName("amber"), isActive: selectedStatus == "Pending") {
                            selectedStatus = selectedStatus == "Pending" ? nil : "Pending"
                        }
                        TaskStatPill(icon: "exclamationmark.triangle", label: "Overdue", value: taskCounts["Overdue"] ?? 0, color: colorForName("rose"), isActive: selectedStatus == "Overdue") {
                            selectedStatus = selectedStatus == "Overdue" ? nil : "Overdue"
                        }
                        TaskStatPill(icon: "checkmark.circle", label: "Completed", value: taskCounts["Completed"] ?? 0, color: colorForName("emerald"), isActive: selectedStatus == "Completed") {
                            selectedStatus = selectedStatus == "Completed" ? nil : "Completed"
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .background(Color(.systemBackground))

                Divider()

                // Search & Filters
                VStack(spacing: 8) {
                    SearchBar(text: $searchText, placeholder: "Search tasks...")
                        .padding(.horizontal, 16)
                        .padding(.top, 10)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(priorityOptions, id: \.self) { opt in
                                FilterChip(label: opt, isActive: (opt == "All" && selectedPriority == nil) || opt == selectedPriority) {
                                    selectedPriority = opt == "All" ? nil : (selectedPriority == opt ? nil : opt)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)
                    }
                }
                .background(Color(.systemBackground))

                Divider()

                // Task List
                if isLoading {
                    LoadingView(message: "Loading tasks...")
                        .frame(maxHeight: .infinity)
                } else if filteredTasks.isEmpty {
                    EmptyStateView(
                        icon: "checklist",
                        title: "No Tasks Found",
                        subtitle: searchText.isEmpty ? "Tap + to add your first task." : "Try adjusting your search or filters.",
                        action: { showAddTask = true },
                        actionLabel: "Add Task"
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    List {
                        ForEach(filteredTasks) { task in
                            TaskRowView(task: task, onEdit: {
                                selectedTask = task
                                showEditTask = true
                            }, onDelete: {
                                taskToDelete = task
                                showDeleteConfirm = true
                            }, onStatusChange: { newStatus in
                                Task { await updateTaskStatus(task: task, status: newStatus) }
                            })
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                            .listRowBackground(Color(.systemGroupedBackground))
                            .listRowSeparator(.hidden)
                        }
                    }
                    .listStyle(.plain)
                    .background(Color(.systemGroupedBackground))
                    .refreshable { await loadData() }
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { Task { await loadData() } }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showAddTask = true }) {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                }
            }
            .sheet(isPresented: $showAddTask) {
                TaskFormView(task: nil, departments: departments, employees: employees) { req in
                    await saveTask(req, id: nil)
                    showAddTask = false
                }
            }
            .sheet(item: $selectedTask) { task in
                TaskFormView(task: task, departments: departments, employees: employees) { req in
                    await saveTask(req, id: task.id)
                    selectedTask = nil
                }
            }
            .alert("Delete Task", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    if let t = taskToDelete {
                        Task { await deleteTask(id: t.id) }
                    }
                }
            } message: {
                Text("Are you sure you want to delete this task? This cannot be undone.")
            }
        }
        .task { await loadData() }
    }

    // MARK: - Data Actions
    private func loadData() async {
        await MainActor.run { isLoading = true }
        async let tasksResult = APIService.shared.getTasks(status: selectedStatus, priority: selectedPriority)
        async let deptsResult = APIService.shared.getDepartments()
        async let empsResult = APIService.shared.getEmployees()
        do {
            let (t, d, e) = try await (tasksResult, deptsResult, empsResult)
            await MainActor.run { tasks = t; departments = d; employees = e; isLoading = false }
        } catch APIError.unauthorized {
            await MainActor.run { auth.logout() }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription; isLoading = false }
        }
    }

    private func saveTask(_ req: CreateDashboardTaskRequest, id: Int?) async {
        do {
            if let id = id {
                let updated = try await APIService.shared.updateTask(id: id, task: req)
                await MainActor.run {
                    if let idx = tasks.firstIndex(where: { $0.id == id }) { tasks[idx] = updated }
                }
            } else {
                let created = try await APIService.shared.createTask(req)
                await MainActor.run { tasks.insert(created, at: 0) }
            }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func deleteTask(id: Int) async {
        do {
            try await APIService.shared.deleteTask(id: id)
            await MainActor.run { tasks.removeAll { $0.id == id } }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func updateTaskStatus(task: DashboardTask, status: String) async {
        do {
            let updated = try await APIService.shared.updateTaskStatus(id: task.id, status: status)
            await MainActor.run {
                if let idx = tasks.firstIndex(where: { $0.id == task.id }) { tasks[idx] = updated }
            }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }
}

// MARK: - Task Stat Pill
struct TaskStatPill: View {
    let icon: String
    let label: String
    let value: Int
    let color: Color
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.12))
                        .frame(width: 36, height: 36)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(color)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(value)")
                        .font(.system(size: 20, weight: .black, design: .rounded))
                    Text(label)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .textCase(.uppercase)
                        .tracking(0.3)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isActive ? color.opacity(0.08) : Color(.secondarySystemBackground))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(isActive ? color.opacity(0.3) : Color.clear, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Task Row View
struct TaskRowView: View {
    let task: DashboardTask
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onStatusChange: (String) -> Void
    @State private var showActions = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                // Status indicator
                Button(action: { toggleStatus() }) {
                    Image(systemName: task.status?.lowercased() == "completed" ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 20))
                        .foregroundColor(statusColor(task.status))
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        if task.is_pinned == true {
                            Image(systemName: "pin.fill")
                                .font(.caption2)
                                .foregroundColor(colorForName("amber"))
                        }
                        Text(task.description)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .lineLimit(2)
                        Spacer()
                        Menu {
                            Button("Edit", action: onEdit)
                            Button("Mark Completed") { onStatusChange("Completed") }
                            Button("Mark Pending") { onStatusChange("Pending") }
                            Divider()
                            Button("Delete", role: .destructive, action: onDelete)
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.system(size: 16))
                                .foregroundColor(.secondary)
                                .padding(4)
                        }
                    }

                    HStack(spacing: 6) {
                        if let agency = task.assigned_agency, !agency.isEmpty {
                            Label(agency, systemImage: "building")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                        if task.assigned_agency != nil && task.deadline_date != nil {
                            Text("·").foregroundColor(.secondary).font(.caption)
                        }
                        if let deadline = task.deadline_date {
                            Label(formatDate(deadline), systemImage: "calendar")
                                .font(.caption)
                                .foregroundColor(isOverdue(deadline) && task.status?.lowercased() != "completed" ? colorForName("rose") : .secondary)
                        }
                    }
                }
            }

            // Badges row
            HStack(spacing: 6) {
                if let status = task.status {
                    StatusBadge(text: status, color: statusColor(status))
                }
                if let priority = task.priority {
                    PriorityBadge(priority: priority)
                }
                if let dept = task.department {
                    StatusBadge(text: dept.name, color: colorForName(dept.color ?? "indigo"))
                }
                if let emp = task.assigned_employee {
                    StatusBadge(text: emp.displayLabel, color: colorForName("violet"))
                }
                Spacer()
                if let num = task.task_number, !num.isEmpty {
                    Text("#\(num)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 1)
    }

    private func toggleStatus() {
        let newStatus = task.status?.lowercased() == "completed" ? "Pending" : "Completed"
        onStatusChange(newStatus)
    }
}

// MARK: - Task Form View
struct TaskFormView: View {
    let task: DashboardTask?
    let departments: [Department]
    let employees: [Employee]
    let onSave: (CreateDashboardTaskRequest) async -> Void

    @Environment(\.dismiss) var dismiss
    @State private var description = ""
    @State private var assignedAgency = ""
    @State private var status = "Pending"
    @State private var priority = "Normal"
    @State private var deadlineDate = ""
    @State private var timeGiven = "7 days"
    @State private var taskNumber = ""
    @State private var remarks = ""
    @State private var stenoComment = ""
    @State private var selectedDeptId: Int? = nil
    @State private var selectedEmpId: Int? = nil
    @State private var isPinned = false
    @State private var isToday = false
    @State private var isSaving = false
    @State private var showAdvanced = false
    @State private var deadlineDateValue = Date()
    @State private var showDatePicker = false

    let statusOptions = ["Pending", "Completed", "Overdue"]
    let priorityOptions = ["Low", "Normal", "High", "Critical"]

    init(task: DashboardTask?, departments: [Department], employees: [Employee], onSave: @escaping (CreateDashboardTaskRequest) async -> Void) {
        self.task = task
        self.departments = departments
        self.employees = employees
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Task Details") {
                    TextField("Description *", text: $description, axis: .vertical)
                        .lineLimit(2...5)
                    TextField("Assigned Agency", text: $assignedAgency)
                    TextField("Task Number", text: $taskNumber)
                }

                Section("Status & Priority") {
                    Picker("Status", selection: $status) {
                        ForEach(statusOptions, id: \.self) { Text($0) }
                    }
                    .pickerStyle(.menu)
                    Picker("Priority", selection: $priority) {
                        ForEach(priorityOptions, id: \.self) { Text($0) }
                    }
                    .pickerStyle(.menu)
                }

                Section("Deadline") {
                    DatePicker("Deadline Date", selection: $deadlineDateValue, displayedComponents: .date)
                        .onChange(of: deadlineDateValue) { newVal in
                            let f = DateFormatter()
                            f.dateFormat = "yyyy-MM-dd"
                            deadlineDate = f.string(from: newVal)
                        }
                    TextField("Time Given (e.g. 7 days)", text: $timeGiven)
                }

                Section("Assignment") {
                    Picker("Department", selection: $selectedDeptId) {
                        Text("None").tag(Optional<Int>.none)
                        ForEach(departments) { dept in
                            Text(dept.name).tag(Optional<Int>.some(dept.id))
                        }
                    }
                    .pickerStyle(.menu)
                    Picker("Assigned Employee", selection: $selectedEmpId) {
                        Text("None").tag(Optional<Int>.none)
                        ForEach(employees) { emp in
                            Text(emp.displayLabel).tag(Optional<Int>.some(emp.id))
                        }
                    }
                    .pickerStyle(.menu)
                }

                Section("Flags") {
                    Toggle("Pinned", isOn: $isPinned)
                    Toggle("Today's Focus", isOn: $isToday)
                }

                Section("Additional Notes") {
                    TextField("Steno Comment", text: $stenoComment, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("Remarks", text: $remarks, axis: .vertical)
                        .lineLimit(2...4)
                }
            }
            .navigationTitle(task == nil ? "New Task" : "Edit Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { Task { await save() } }) {
                        if isSaving {
                            ProgressView().scaleEffect(0.8)
                        } else {
                            Text("Save").fontWeight(.semibold)
                        }
                    }
                    .disabled(description.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
            .onAppear { prefill() }
        }
    }

    private func prefill() {
        guard let t = task else { return }
        description = t.description
        assignedAgency = t.assigned_agency ?? ""
        status = t.status ?? "Pending"
        priority = t.priority ?? "Normal"
        deadlineDate = t.deadline_date ?? ""
        timeGiven = t.time_given ?? "7 days"
        taskNumber = t.task_number ?? ""
        remarks = t.remarks ?? ""
        stenoComment = t.steno_comment ?? ""
        selectedDeptId = t.department_id
        selectedEmpId = t.assigned_employee_id
        isPinned = t.is_pinned ?? false
        isToday = t.is_today ?? false
        if let dd = t.deadline_date {
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
            if let d = f.date(from: dd) { deadlineDateValue = d }
        }
    }

    private func save() async {
        isSaving = true
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        let dl = deadlineDate.isEmpty ? f.string(from: deadlineDateValue) : deadlineDate
        let req = CreateDashboardTaskRequest(
            description: description.trimmingCharacters(in: .whitespaces),
            assigned_agency: assignedAgency.isEmpty ? nil : assignedAgency,
            status: status,
            priority: priority,
            allocated_date: f.string(from: Date()),
            deadline_date: dl,
            time_given: timeGiven,
            days_given: nil,
            steno_comment: stenoComment.isEmpty ? nil : stenoComment,
            remarks: remarks.isEmpty ? nil : remarks,
            department_id: selectedDeptId,
            assigned_employee_id: selectedEmpId,
            task_number: taskNumber.isEmpty ? nil : taskNumber,
            completion_date: nil,
            is_pinned: isPinned,
            is_today: isToday
        )
        await onSave(req)
        isSaving = false
    }
}
