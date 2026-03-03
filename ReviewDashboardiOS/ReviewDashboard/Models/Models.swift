import Foundation

// MARK: - Auth Models
struct LoginRequest: Encodable {
    let username: String
    let password: String
}

struct LoginResponse: Decodable {
    let access_token: String
    let token_type: String
    let user: User
}

struct User: Codable, Identifiable {
    let id: Int
    let username: String
    let email: String?
    let role: String
    let is_active: Bool?
    let module_access: [String]?
    let display_username: String?
    let hint: String?

    var displayName: String {
        display_username ?? username
    }

    var isAdmin: Bool {
        role == "admin"
    }
}

struct HintResponse: Decodable {
    let hint: String?
}

// MARK: - Department Models
struct Department: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String?
    let color: String?
    let category_name: String?
    let category_order: Int?
    let display_order: Int?
    let priority_level: String?
    let review_health: ReviewHealth?
    let total_tasks: Int?
    let pending_tasks: Int?
    let overdue_tasks: Int?
    let completed_tasks: Int?
    let agenda_items: [AgendaItem]?
}

struct ReviewHealth: Codable {
    let days_since_last_review: Int?
    let last_review_date: String?
    let total_reviews: Int?
    let status: String?
}

struct AgendaItem: Codable, Identifiable {
    let id: Int
    let department_id: Int?
    let title: String
    let description: String?
    let status: String?
    let priority: String?
    let due_date: String?
    let created_at: String?
}

// MARK: - DashboardTask Models
struct DashboardTask: Codable, Identifiable {
    let id: Int
    let task_number: String?
    let description: String
    let assigned_agency: String?
    let status: String?
    let priority: String?
    let allocated_date: String?
    let deadline_date: String?
    let completion_date: String?
    let time_given: String?
    let days_given: Int?
    let steno_comment: String?
    let remarks: String?
    let department_id: Int?
    let assigned_employee_id: Int?
    let is_pinned: Bool?
    let is_today: Bool?
    let department: Department?
    let assigned_employee: Employee?
    let created_at: String?
    let updated_at: String?
}

struct CreateDashboardTaskRequest: Encodable {
    var description: String
    var assigned_agency: String?
    var status: String?
    var priority: String?
    var allocated_date: String?
    var deadline_date: String?
    var time_given: String?
    var days_given: Int?
    var steno_comment: String?
    var remarks: String?
    var department_id: Int?
    var assigned_employee_id: Int?
    var task_number: String?
    var completion_date: String?
    var is_pinned: Bool?
    var is_today: Bool?
}

// MARK: - Employee Models
struct Employee: Codable, Identifiable {
    let id: Int
    let name: String
    let mobile_number: String?
    let display_username: String?
    let department_id: Int?
    let department: Department?
    let task_count: Int?

    var displayLabel: String {
        let dn = (display_username ?? "").trimmingCharacters(in: .whitespaces)
        if !dn.isEmpty { return dn }
        return name
    }
}

struct CreateEmployeeRequest: Encodable {
    var name: String
    var mobile_number: String?
    var display_username: String?
    var department_id: Int?
}

// MARK: - Analytics Models
struct TaskAnalytics: Decodable {
    let summary: AnalyticsSummary?
    let health: [DepartmentHealth]?
    let critical_bottlenecks: [DashboardTask]?
    let highest_workload: [EmployeeWorkload]?
    let oldest_pending: [DashboardTask]?
    let agency_performance: [AgencyPerformance]?
    let generated_at: String?
}

struct AnalyticsSummary: Decodable {
    let total: Int?
    let completed: Int?
    let pending: Int?
    let overdue: Int?
    let in_progress: Int?
}

struct DepartmentHealth: Decodable {
    let department_id: Int?
    let department_name: String?
    let total: Int?
    let completed: Int?
    let pending: Int?
    let overdue: Int?
    let completion_rate: Double?
}

struct EmployeeWorkload: Decodable {
    let employee_id: Int?
    let employee_name: String?
    let task_count: Int?
    let pending: Int?
    let overdue: Int?
}

struct AgencyPerformance: Decodable {
    let agency: String?
    let total: Int?
    let completed: Int?
    let pending: Int?
    let overdue: Int?
    let completion_rate: Double?
}

// MARK: - Todo Models
struct Todo: Codable, Identifiable {
    let id: Int
    let description: String
    let status: String?
    let priority: String?
    let assigned_employee_id: Int?
    let assigned_employee: Employee?
    let created_at: String?
    let updated_at: String?
    let due_date: String?
}

struct CreateTodoRequest: Encodable {
    var description: String
    var status: String?
    var priority: String?
    var assigned_employee_id: Int?
    var due_date: String?
}

// MARK: - Field Visit Models
struct FieldVisit: Codable, Identifiable {
    let id: Int
    let title: String
    let location: String?
    let visit_date: String?
    let status: String?
    let notes: String?
    let assigned_employee_id: Int?
    let assigned_employee: Employee?
    let department_id: Int?
    let department: Department?
    let created_at: String?
}

struct CreateFieldVisitRequest: Encodable {
    var title: String
    var location: String?
    var visit_date: String?
    var status: String?
    var notes: String?
    var assigned_employee_id: Int?
    var department_id: Int?
}

// MARK: - Planner Models
struct PlannerEvent: Codable, Identifiable {
    let id: Int
    let title: String
    let description: String?
    let event_date: String?
    let event_time: String?
    let event_type: String?
    let status: String?
    let department_id: Int?
    let department: Department?
    let created_at: String?
}

// MARK: - Review Models
struct ReviewSession: Codable, Identifiable {
    let id: Int
    let department_id: Int?
    let review_date: String?
    let notes: String?
    let status: String?
    let department: Department?
    let created_at: String?
}

// MARK: - Overview Models
struct OverviewStats: Decodable {
    let departments: Int?
    let total_tasks: Int?
    let pending_tasks: Int?
    let overdue_tasks: Int?
    let completed_tasks: Int?
    let employees: Int?
    let field_visits: Int?
    let todos: Int?
}

// MARK: - Access Module
struct ModuleAccess: Decodable {
    let modules: [String]
}

// MARK: - Pagination / Generic
struct PaginatedResponse<T: Decodable>: Decodable {
    let items: [T]?
    let total: Int?
    let page: Int?
    let pages: Int?
}
