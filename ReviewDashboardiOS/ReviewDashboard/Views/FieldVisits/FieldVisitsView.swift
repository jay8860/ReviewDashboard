import SwiftUI

struct FieldVisitsView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var visits: [FieldVisit] = []
    @State private var employees: [Employee] = []
    @State private var departments: [Department] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var searchText = ""
    @State private var selectedStatus: String? = nil
    @State private var showAddVisit = false
    @State private var selectedVisit: FieldVisit? = nil
    @State private var visitToDelete: FieldVisit? = nil
    @State private var showDeleteConfirm = false

    let statusOptions = ["All", "Scheduled", "Completed", "Cancelled"]

    var filteredVisits: [FieldVisit] {
        visits.filter { visit in
            let matchesSearch = searchText.isEmpty ||
                visit.title.localizedCaseInsensitiveContains(searchText) ||
                (visit.location?.localizedCaseInsensitiveContains(searchText) ?? false)
            let matchesStatus = selectedStatus == nil || visit.status == selectedStatus
            return matchesSearch && matchesStatus
        }
        .sorted { ($0.visit_date ?? "") > ($1.visit_date ?? "") }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search & Filter
                VStack(spacing: 8) {
                    SearchBar(text: $searchText, placeholder: "Search field visits...")
                        .padding(.horizontal, 16)
                        .padding(.top, 10)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(statusOptions, id: \.self) { opt in
                                FilterChip(label: opt, isActive: (opt == "All" && selectedStatus == nil) || opt == selectedStatus) {
                                    selectedStatus = opt == "All" ? nil : (selectedStatus == opt ? nil : opt)
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
                    LoadingView(message: "Loading field visits...").frame(maxHeight: .infinity)
                } else if filteredVisits.isEmpty {
                    EmptyStateView(
                        icon: "map",
                        title: "No Field Visits",
                        subtitle: searchText.isEmpty ? "Tap + to schedule a field visit." : "No results found.",
                        action: { showAddVisit = true },
                        actionLabel: "Schedule Visit"
                    ).frame(maxHeight: .infinity)
                } else {
                    List {
                        ForEach(filteredVisits) { visit in
                            FieldVisitRow(visit: visit,
                                onEdit: { selectedVisit = visit },
                                onDelete: { visitToDelete = visit; showDeleteConfirm = true })
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
            .navigationTitle("Field Visits")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { Task { await loadData() } }) { Image(systemName: "arrow.clockwise") }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showAddVisit = true }) {
                        Image(systemName: "plus").fontWeight(.semibold)
                    }
                }
            }
            .sheet(isPresented: $showAddVisit) {
                FieldVisitFormView(visit: nil, employees: employees, departments: departments) { req in
                    await createVisit(req)
                    showAddVisit = false
                }
            }
            .sheet(item: $selectedVisit) { visit in
                FieldVisitFormView(visit: visit, employees: employees, departments: departments) { req in
                    await updateVisit(id: visit.id, req: req)
                    selectedVisit = nil
                }
            }
            .alert("Delete Visit", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    if let v = visitToDelete { Task { await deleteVisit(id: v.id) } }
                }
            } message: { Text("Are you sure you want to delete this field visit?") }
        }
        .task { await loadData() }
    }

    private func loadData() async {
        await MainActor.run { isLoading = true }
        async let visitsResult = APIService.shared.getFieldVisits()
        async let empsResult = APIService.shared.getEmployees()
        async let deptsResult = APIService.shared.getDepartments()
        do {
            let (v, e, d) = try await (visitsResult, empsResult, deptsResult)
            await MainActor.run { visits = v; employees = e; departments = d; isLoading = false }
        } catch APIError.unauthorized {
            await MainActor.run { auth.logout() }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription; isLoading = false }
        }
    }

    private func createVisit(_ req: CreateFieldVisitRequest) async {
        do {
            let v = try await APIService.shared.createFieldVisit(req)
            await MainActor.run { visits.insert(v, at: 0) }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func updateVisit(id: Int, req: CreateFieldVisitRequest) async {
        do {
            let v = try await APIService.shared.updateFieldVisit(id: id, visit: req)
            await MainActor.run {
                if let idx = visits.firstIndex(where: { $0.id == id }) { visits[idx] = v }
            }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }

    private func deleteVisit(id: Int) async {
        do {
            try await APIService.shared.deleteFieldVisit(id: id)
            await MainActor.run { visits.removeAll { $0.id == id } }
        } catch { await MainActor.run { errorMessage = error.localizedDescription } }
    }
}

// MARK: - Field Visit Row
struct FieldVisitRow: View {
    let visit: FieldVisit
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(visit.title)
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        if let loc = visit.location, !loc.isEmpty {
                            Label(loc, systemImage: "mappin")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                        if let date = visit.visit_date {
                            Label(formatDate(date), systemImage: "calendar")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                Spacer()
                Menu {
                    Button("Edit", action: onEdit)
                    Button("Delete", role: .destructive, action: onDelete)
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                        .padding(4)
                }
            }

            HStack(spacing: 6) {
                if let status = visit.status {
                    StatusBadge(text: status, color: statusColor(status))
                }
                if let emp = visit.assigned_employee {
                    StatusBadge(text: emp.displayLabel, color: colorForName("violet"))
                }
                if let dept = visit.department {
                    StatusBadge(text: dept.name, color: colorForName(dept.color ?? "indigo"))
                }
            }

            if let notes = visit.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 1)
    }
}

// MARK: - Field Visit Form
struct FieldVisitFormView: View {
    let visit: FieldVisit?
    let employees: [Employee]
    let departments: [Department]
    let onSave: (CreateFieldVisitRequest) async -> Void

    @Environment(\.dismiss) var dismiss
    @State private var title = ""
    @State private var location = ""
    @State private var status = "Scheduled"
    @State private var notes = ""
    @State private var visitDate = Date()
    @State private var selectedEmpId: Int? = nil
    @State private var selectedDeptId: Int? = nil
    @State private var isSaving = false

    let statusOptions = ["Scheduled", "Completed", "Cancelled", "In Progress"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Visit Details") {
                    TextField("Title *", text: $title)
                    TextField("Location", text: $location)
                    DatePicker("Visit Date", selection: $visitDate, displayedComponents: .date)
                    Picker("Status", selection: $status) {
                        ForEach(statusOptions, id: \.self) { Text($0) }
                    }.pickerStyle(.menu)
                }
                Section("Assignment") {
                    Picker("Employee", selection: $selectedEmpId) {
                        Text("None").tag(Optional<Int>.none)
                        ForEach(employees) { emp in Text(emp.displayLabel).tag(Optional<Int>.some(emp.id)) }
                    }.pickerStyle(.menu)
                    Picker("Department", selection: $selectedDeptId) {
                        Text("None").tag(Optional<Int>.none)
                        ForEach(departments) { dept in Text(dept.name).tag(Optional<Int>.some(dept.id)) }
                    }.pickerStyle(.menu)
                }
                Section("Notes") {
                    TextField("Notes", text: $notes, axis: .vertical).lineLimit(3...6)
                }
            }
            .navigationTitle(visit == nil ? "New Field Visit" : "Edit Visit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { Task { await save() } }) {
                        if isSaving { ProgressView().scaleEffect(0.8) }
                        else { Text("Save").fontWeight(.semibold) }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
            .onAppear { prefill() }
        }
    }

    private func prefill() {
        guard let v = visit else { return }
        title = v.title
        location = v.location ?? ""
        status = v.status ?? "Scheduled"
        notes = v.notes ?? ""
        selectedEmpId = v.assigned_employee_id
        selectedDeptId = v.department_id
        if let vd = v.visit_date {
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
            if let d = f.date(from: vd) { visitDate = d }
        }
    }

    private func save() async {
        isSaving = true
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        let req = CreateFieldVisitRequest(
            title: title.trimmingCharacters(in: .whitespaces),
            location: location.isEmpty ? nil : location,
            visit_date: f.string(from: visitDate),
            status: status,
            notes: notes.isEmpty ? nil : notes,
            assigned_employee_id: selectedEmpId,
            department_id: selectedDeptId
        )
        await onSave(req)
        isSaving = false
    }
}
