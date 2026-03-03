import SwiftUI

struct TodosView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var todos: [Todo] = []
    @State private var employees: [Employee] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showAddTodo = false
    @State private var selectedTodo: Todo? = nil
    @State private var todoToDelete: Todo? = nil
    @State private var showDeleteConfirm = false

    var pendingTodos: [Todo] { todos.filter { $0.status?.lowercased() != "completed" } }
    var completedTodos: [Todo] { todos.filter { $0.status?.lowercased() == "completed" } }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    LoadingView(message: "Loading to-do list...")
                } else if todos.isEmpty {
                    EmptyStateView(
                        icon: "list.bullet",
                        title: "No Todos",
                        subtitle: "Tap + to add your first todo.",
                        action: { showAddTodo = true },
                        actionLabel: "Add Todo"
                    )
                } else {
                    List {
                        if !pendingTodos.isEmpty {
                            Section(header: Text("Pending (\(pendingTodos.count))").font(.caption).fontWeight(.black).textCase(.uppercase)) {
                                ForEach(pendingTodos) { todo in
                                    TodoRow(todo: todo, employees: employees,
                                            onComplete: { Task { await completeTodo(id: todo.id) } },
                                            onEdit: { selectedTodo = todo },
                                            onDelete: { todoToDelete = todo; showDeleteConfirm = true })
                                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                                    .listRowBackground(Color(.systemGroupedBackground))
                                    .listRowSeparator(.hidden)
                                }
                            }
                        }

                        if !completedTodos.isEmpty {
                            Section(header: Text("Completed (\(completedTodos.count))").font(.caption).fontWeight(.black).textCase(.uppercase)) {
                                ForEach(completedTodos) { todo in
                                    TodoRow(todo: todo, employees: employees,
                                            onComplete: nil,
                                            onEdit: { selectedTodo = todo },
                                            onDelete: { todoToDelete = todo; showDeleteConfirm = true })
                                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                                    .listRowBackground(Color(.systemGroupedBackground))
                                    .listRowSeparator(.hidden)
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .background(Color(.systemGroupedBackground))
                    .refreshable { await loadData() }
                }
            }
            .navigationTitle("To-Do List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { Task { await loadData() } }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showAddTodo = true }) {
                        Image(systemName: "plus").fontWeight(.semibold)
                    }
                }
            }
            .sheet(isPresented: $showAddTodo) {
                TodoFormView(todo: nil, employees: employees) { req in
                    await createTodo(req)
                    showAddTodo = false
                }
            }
            .sheet(item: $selectedTodo) { todo in
                TodoFormView(todo: todo, employees: employees) { req in
                    await updateTodo(id: todo.id, req: req)
                    selectedTodo = nil
                }
            }
            .alert("Delete Todo", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    if let t = todoToDelete { Task { await deleteTodo(id: t.id) } }
                }
            } message: { Text("Are you sure you want to delete this todo?") }
        }
        .task { await loadData() }
    }

    private func loadData() async {
        await MainActor.run { isLoading = true }
        async let todosResult = APIService.shared.getTodos()
        async let empsResult = APIService.shared.getEmployees()
        do {
            let (t, e) = try await (todosResult, empsResult)
            await MainActor.run { todos = t; employees = e; isLoading = false }
        } catch APIError.unauthorized {
            await MainActor.run { auth.logout() }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription; isLoading = false }
        }
    }

    private func completeTodo(id: Int) async {
        do {
            let updated = try await APIService.shared.completeTodo(id: id)
            await MainActor.run {
                if let idx = todos.firstIndex(where: { $0.id == id }) { todos[idx] = updated }
            }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func createTodo(_ req: CreateTodoRequest) async {
        do {
            let todo = try await APIService.shared.createTodo(req)
            await MainActor.run { todos.insert(todo, at: 0) }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func updateTodo(id: Int, req: CreateTodoRequest) async {
        do {
            let updated = try await APIService.shared.updateTodo(id: id, todo: req)
            await MainActor.run {
                if let idx = todos.firstIndex(where: { $0.id == id }) { todos[idx] = updated }
            }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func deleteTodo(id: Int) async {
        do {
            try await APIService.shared.deleteTodo(id: id)
            await MainActor.run { todos.removeAll { $0.id == id } }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }
}

// MARK: - Todo Row
struct TodoRow: View {
    let todo: Todo
    let employees: [Employee]
    let onComplete: (() -> Void)?
    let onEdit: () -> Void
    let onDelete: () -> Void

    var isCompleted: Bool { todo.status?.lowercased() == "completed" }

    var assignedEmployee: Employee? {
        guard let id = todo.assigned_employee_id else { return nil }
        return employees.first { $0.id == id }
    }

    var body: some View {
        HStack(spacing: 12) {
            Button(action: { onComplete?() }) {
                Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundColor(isCompleted ? colorForName("emerald") : .secondary)
            }
            .buttonStyle(.plain)
            .disabled(isCompleted)

            VStack(alignment: .leading, spacing: 4) {
                Text(todo.description)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .strikethrough(isCompleted, color: .secondary)
                    .foregroundColor(isCompleted ? .secondary : .primary)
                    .lineLimit(2)

                HStack(spacing: 8) {
                    if let emp = assignedEmployee ?? todo.assigned_employee {
                        Label(emp.displayLabel, systemImage: "person")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    if let due = todo.due_date {
                        Label(formatDate(due), systemImage: "calendar")
                            .font(.caption)
                            .foregroundColor(isOverdue(due) && !isCompleted ? colorForName("rose") : .secondary)
                    }
                    if let priority = todo.priority {
                        PriorityBadge(priority: priority)
                    }
                }
            }

            Spacer()

            Menu {
                Button("Edit", action: onEdit)
                if !isCompleted {
                    Button("Mark Complete") { onComplete?() }
                }
                Divider()
                Button("Delete", role: .destructive, action: onDelete)
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 16))
                    .foregroundColor(.secondary)
                    .padding(4)
            }
        }
        .padding(12)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .opacity(isCompleted ? 0.65 : 1.0)
    }
}

// MARK: - Todo Form
struct TodoFormView: View {
    let todo: Todo?
    let employees: [Employee]
    let onSave: (CreateTodoRequest) async -> Void

    @Environment(\.dismiss) var dismiss
    @State private var description = ""
    @State private var status = "Pending"
    @State private var priority = "Normal"
    @State private var selectedEmpId: Int? = nil
    @State private var dueDate = Date()
    @State private var hasDueDate = false
    @State private var isSaving = false

    let statusOptions = ["Pending", "In Progress", "Completed"]
    let priorityOptions = ["Low", "Normal", "High", "Critical"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Description *", text: $description, axis: .vertical)
                        .lineLimit(2...5)
                }
                Section("Status & Priority") {
                    Picker("Status", selection: $status) {
                        ForEach(statusOptions, id: \.self) { Text($0) }
                    }.pickerStyle(.menu)
                    Picker("Priority", selection: $priority) {
                        ForEach(priorityOptions, id: \.self) { Text($0) }
                    }.pickerStyle(.menu)
                }
                Section("Due Date") {
                    Toggle("Set Due Date", isOn: $hasDueDate)
                    if hasDueDate {
                        DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)
                    }
                }
                Section("Assign To") {
                    Picker("Employee", selection: $selectedEmpId) {
                        Text("None").tag(Optional<Int>.none)
                        ForEach(employees) { emp in
                            Text(emp.displayLabel).tag(Optional<Int>.some(emp.id))
                        }
                    }.pickerStyle(.menu)
                }
            }
            .navigationTitle(todo == nil ? "New Todo" : "Edit Todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { Task { await save() } }) {
                        if isSaving { ProgressView().scaleEffect(0.8) }
                        else { Text("Save").fontWeight(.semibold) }
                    }
                    .disabled(description.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
            .onAppear { prefill() }
        }
    }

    private func prefill() {
        guard let t = todo else { return }
        description = t.description
        status = t.status ?? "Pending"
        priority = t.priority ?? "Normal"
        selectedEmpId = t.assigned_employee_id
        if let due = t.due_date {
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
            if let d = f.date(from: due) { dueDate = d; hasDueDate = true }
        }
    }

    private func save() async {
        isSaving = true
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        let req = CreateTodoRequest(
            description: description.trimmingCharacters(in: .whitespaces),
            status: status,
            priority: priority,
            assigned_employee_id: selectedEmpId,
            due_date: hasDueDate ? f.string(from: dueDate) : nil
        )
        await onSave(req)
        isSaving = false
    }
}
