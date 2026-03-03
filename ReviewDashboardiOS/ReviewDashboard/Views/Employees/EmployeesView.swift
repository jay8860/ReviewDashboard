import SwiftUI

struct EmployeesView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var employees: [Employee] = []
    @State private var departments: [Department] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var searchText = ""
    @State private var selectedDeptId: Int? = nil
    @State private var showAddEmployee = false
    @State private var selectedEmployee: Employee? = nil
    @State private var empToDelete: Employee? = nil
    @State private var showDeleteConfirm = false

    var filteredEmployees: [Employee] {
        employees.filter { emp in
            let matchesSearch = searchText.isEmpty ||
                emp.name.localizedCaseInsensitiveContains(searchText) ||
                (emp.display_username?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (emp.mobile_number?.localizedCaseInsensitiveContains(searchText) ?? false)
            let matchesDept = selectedDeptId == nil || emp.department_id == selectedDeptId
            return matchesSearch && matchesDept
        }
        .sorted { $0.displayLabel.localizedCompare($1.displayLabel) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search & Filter
                VStack(spacing: 8) {
                    SearchBar(text: $searchText, placeholder: "Search employees...")
                        .padding(.horizontal, 16)
                        .padding(.top, 10)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            FilterChip(label: "All", isActive: selectedDeptId == nil) {
                                selectedDeptId = nil
                            }
                            ForEach(departments) { dept in
                                FilterChip(label: dept.name, isActive: selectedDeptId == dept.id) {
                                    selectedDeptId = selectedDeptId == dept.id ? nil : dept.id
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)
                    }
                }
                .background(Color(.systemBackground))

                Divider()

                if isLoading {
                    LoadingView(message: "Loading employees...")
                        .frame(maxHeight: .infinity)
                } else if filteredEmployees.isEmpty {
                    EmptyStateView(
                        icon: "person.2",
                        title: "No Employees",
                        subtitle: searchText.isEmpty ? "Tap + to add an employee." : "No employees match your search.",
                        action: auth.isAdmin ? { showAddEmployee = true } : nil,
                        actionLabel: "Add Employee"
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    List {
                        ForEach(filteredEmployees) { emp in
                            EmployeeRow(emp: emp, onEdit: auth.isAdmin ? {
                                selectedEmployee = emp
                            } : nil, onDelete: auth.isAdmin ? {
                                empToDelete = emp
                                showDeleteConfirm = true
                            } : nil)
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
            .navigationTitle("Employees")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { Task { await loadData() } }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showAddEmployee = true }) {
                        Image(systemName: "plus").fontWeight(.semibold)
                    }
                    .opacity(auth.isAdmin ? 1 : 0)
                    .disabled(!auth.isAdmin)
                }
            }
            .sheet(isPresented: $showAddEmployee) {
                EmployeeFormView(employee: nil, departments: departments) { req in
                    await createEmployee(req)
                    showAddEmployee = false
                }
            }
            .sheet(item: $selectedEmployee) { emp in
                EmployeeFormView(employee: emp, departments: departments) { req in
                    await updateEmployee(id: emp.id, req: req)
                    selectedEmployee = nil
                }
            }
            .alert("Delete Employee", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    if let e = empToDelete { Task { await deleteEmployee(id: e.id) } }
                }
            } message: { Text("Are you sure you want to delete this employee?") }
        }
        .task { await loadData() }
    }

    private func loadData() async {
        await MainActor.run { isLoading = true }
        async let empsResult = APIService.shared.getEmployees()
        async let deptsResult = APIService.shared.getDepartments()
        do {
            let (e, d) = try await (empsResult, deptsResult)
            await MainActor.run { employees = e; departments = d; isLoading = false }
        } catch APIError.unauthorized {
            await MainActor.run { auth.logout() }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription; isLoading = false }
        }
    }

    private func createEmployee(_ req: CreateEmployeeRequest) async {
        do {
            let emp = try await APIService.shared.createEmployee(req)
            await MainActor.run { employees.append(emp) }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func updateEmployee(id: Int, req: CreateEmployeeRequest) async {
        do {
            let emp = try await APIService.shared.updateEmployee(id: id, emp: req)
            await MainActor.run {
                if let idx = employees.firstIndex(where: { $0.id == id }) { employees[idx] = emp }
            }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func deleteEmployee(id: Int) async {
        do {
            try await APIService.shared.deleteEmployee(id: id)
            await MainActor.run { employees.removeAll { $0.id == id } }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }
}

// MARK: - Employee Row
struct EmployeeRow: View {
    let emp: Employee
    let onEdit: (() -> Void)?
    let onDelete: (() -> Void)?

    var initials: String {
        let words = emp.displayLabel.split(separator: " ")
        if words.count >= 2 {
            return String(words[0].prefix(1)) + String(words[1].prefix(1))
        }
        return String(emp.displayLabel.prefix(2)).uppercased()
    }

    var avatarColor: Color {
        let colors: [Color] = [.brandIndigo, colorForName("emerald"), colorForName("amber"), colorForName("rose"), colorForName("sky"), colorForName("violet"), colorForName("teal"), colorForName("orange")]
        let index = abs(emp.name.hashValue) % colors.count
        return colors[index]
    }

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(avatarColor.opacity(0.15))
                    .frame(width: 44, height: 44)
                Text(initials)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(avatarColor)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(emp.displayLabel)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                if emp.displayLabel != emp.name {
                    Text(emp.name)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                HStack(spacing: 8) {
                    if let mobile = emp.mobile_number, !mobile.isEmpty {
                        Label(mobile, systemImage: "phone")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    if let dept = emp.department {
                        Label(dept.name, systemImage: "building.2")
                            .font(.caption)
                            .foregroundColor(colorForName(dept.color ?? "indigo"))
                    }
                }
            }

            Spacer()

            if let count = emp.task_count, count > 0 {
                Text("\(count) tasks")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if onEdit != nil || onDelete != nil {
                Menu {
                    if let edit = onEdit { Button("Edit", action: edit) }
                    if let del = onDelete { Button("Delete", role: .destructive, action: del) }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                        .padding(4)
                }
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 1)
    }
}

// MARK: - Employee Form
struct EmployeeFormView: View {
    let employee: Employee?
    let departments: [Department]
    let onSave: (CreateEmployeeRequest) async -> Void

    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var mobile = ""
    @State private var displayUsername = ""
    @State private var selectedDeptId: Int? = nil
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Employee Details") {
                    TextField("Full Name *", text: $name)
                    TextField("Display Username", text: $displayUsername)
                    TextField("Mobile Number", text: $mobile)
                        .keyboardType(.phonePad)
                }
                Section("Department") {
                    Picker("Department", selection: $selectedDeptId) {
                        Text("None").tag(Optional<Int>.none)
                        ForEach(departments) { dept in
                            Text(dept.name).tag(Optional<Int>.some(dept.id))
                        }
                    }
                    .pickerStyle(.menu)
                }
            }
            .navigationTitle(employee == nil ? "New Employee" : "Edit Employee")
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
        guard let e = employee else { return }
        name = e.name
        mobile = e.mobile_number ?? ""
        displayUsername = e.display_username ?? ""
        selectedDeptId = e.department_id
    }

    private func save() async {
        isSaving = true
        let req = CreateEmployeeRequest(
            name: name.trimmingCharacters(in: .whitespaces),
            mobile_number: mobile.isEmpty ? nil : mobile,
            display_username: displayUsername.isEmpty ? nil : displayUsername,
            department_id: selectedDeptId
        )
        await onSave(req)
        isSaving = false
    }
}
