import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(Int, String)
    case unauthorized
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noData: return "No data received"
        case .decodingError(let e): return "Decoding error: \(e.localizedDescription)"
        case .serverError(let code, let msg): return "Server error \(code): \(msg)"
        case .unauthorized: return "Session expired. Please log in again."
        case .unknown(let e): return e.localizedDescription
        }
    }
}

class APIService {
    static let shared = APIService()

    let baseURL = "https://reviewdashboard-production.up.railway.app"

    private init() {}

    private var token: String? {
        UserDefaults.standard.string(forKey: "auth_token")
    }

    private func makeRequest(method: String, path: String, body: Data? = nil) throws -> URLRequest {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body
        request.timeoutInterval = 30
        return request
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }
        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }
        if httpResponse.statusCode >= 400 {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.serverError(httpResponse.statusCode, msg)
        }
        let decoder = JSONDecoder()
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func performEmpty(_ request: URLRequest) async throws {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }
        if httpResponse.statusCode == 401 { throw APIError.unauthorized }
        if httpResponse.statusCode >= 400 {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.serverError(httpResponse.statusCode, msg)
        }
    }

    private func encode<T: Encodable>(_ value: T) throws -> Data {
        return try JSONEncoder().encode(value)
    }

    // MARK: - Auth
    func login(username: String, password: String) async throws -> LoginResponse {
        let normalizedUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedPassword = password.trimmingCharacters(in: .newlines)

        let primaryBody = try encode(LoginRequest(username: normalizedUsername, password: normalizedPassword))
        let primaryReq = try makeRequest(method: "POST", path: "/api/auth/login", body: primaryBody)
        do {
            return try await perform(primaryReq)
        } catch let error as APIError {
            if case .serverError(_, let message) = error {
            let lower = normalizedUsername.lowercased()
            let shouldRetryLowercase = lower != normalizedUsername && message.localizedCaseInsensitiveContains("Invalid username or password")
            if shouldRetryLowercase {
                let fallbackBody = try encode(LoginRequest(username: lower, password: normalizedPassword))
                let fallbackReq = try makeRequest(method: "POST", path: "/api/auth/login", body: fallbackBody)
                return try await perform(fallbackReq)
            }
            }
            throw error
        }
    }

    func forgotPassword(email: String) async throws {
        struct Payload: Encodable { let email: String }
        let body = try encode(Payload(email: email))
        let req = try makeRequest(method: "POST", path: "/api/auth/forgot-password", body: body)
        try await performEmpty(req)
    }

    func getHint(username: String) async throws -> HintResponse {
        let req = try makeRequest(method: "GET", path: "/api/auth/hint/\(username)")
        return try await perform(req)
    }

    func getUsers() async throws -> [User] {
        let req = try makeRequest(method: "GET", path: "/api/auth/users")
        return try await perform(req)
    }

    // MARK: - Departments
    func getDepartments() async throws -> [Department] {
        let req = try makeRequest(method: "GET", path: "/api/departments/")
        return try await perform(req)
    }

    func getDepartment(id: Int) async throws -> Department {
        let req = try makeRequest(method: "GET", path: "/api/departments/\(id)")
        return try await perform(req)
    }

    func createDepartment(name: String, description: String?, color: String?, categoryName: String?, priorityLevel: String?) async throws -> Department {
        struct Payload: Encodable {
            let name: String
            let description: String?
            let color: String?
            let category_name: String?
            let priority_level: String?
        }
        let body = try encode(Payload(name: name, description: description, color: color, category_name: categoryName, priority_level: priorityLevel))
        let req = try makeRequest(method: "POST", path: "/api/departments/", body: body)
        return try await perform(req)
    }

    func updateDepartment(id: Int, name: String, description: String?, color: String?, categoryName: String?, priorityLevel: String?) async throws -> Department {
        struct Payload: Encodable {
            let name: String
            let description: String?
            let color: String?
            let category_name: String?
            let priority_level: String?
        }
        let body = try encode(Payload(name: name, description: description, color: color, category_name: categoryName, priority_level: priorityLevel))
        let req = try makeRequest(method: "PUT", path: "/api/departments/\(id)", body: body)
        return try await perform(req)
    }

    func deleteDepartment(id: Int) async throws {
        let req = try makeRequest(method: "DELETE", path: "/api/departments/\(id)")
        try await performEmpty(req)
    }

    // MARK: - DashboardTasks
    func getTasks(status: String? = nil, priority: String? = nil, departmentId: Int? = nil, employeeId: Int? = nil, search: String? = nil) async throws -> [DashboardTask] {
        var components = URLComponents(string: baseURL + "/api/tasks/")!
        var items: [URLQueryItem] = []
        if let s = status { items.append(URLQueryItem(name: "status", value: s)) }
        if let p = priority { items.append(URLQueryItem(name: "priority", value: p)) }
        if let d = departmentId { items.append(URLQueryItem(name: "department_id", value: "\(d)")) }
        if let e = employeeId { items.append(URLQueryItem(name: "assigned_employee_id", value: "\(e)")) }
        if let q = search { items.append(URLQueryItem(name: "search", value: q)) }
        components.queryItems = items.isEmpty ? nil : items
        guard let url = components.url else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.timeoutInterval = 30
        return try await perform(req)
    }

    func createTask(_ task: CreateDashboardTaskRequest) async throws -> DashboardTask {
        let body = try encode(task)
        let req = try makeRequest(method: "POST", path: "/api/tasks/", body: body)
        return try await perform(req)
    }

    func updateTask(id: Int, task: CreateDashboardTaskRequest) async throws -> DashboardTask {
        let body = try encode(task)
        let req = try makeRequest(method: "PUT", path: "/api/tasks/\(id)", body: body)
        return try await perform(req)
    }

    func deleteTask(id: Int) async throws {
        let req = try makeRequest(method: "DELETE", path: "/api/tasks/\(id)")
        try await performEmpty(req)
    }

    func updateTaskStatus(id: Int, status: String) async throws -> DashboardTask {
        struct Payload: Encodable { let status: String }
        let body = try encode(Payload(status: status))
        let req = try makeRequest(method: "PATCH", path: "/api/tasks/\(id)/status", body: body)
        return try await perform(req)
    }

    // MARK: - Employees
    func getEmployees(departmentId: Int? = nil, search: String? = nil) async throws -> [Employee] {
        var components = URLComponents(string: baseURL + "/api/employees/")!
        var items: [URLQueryItem] = []
        if let d = departmentId { items.append(URLQueryItem(name: "department_id", value: "\(d)")) }
        if let q = search { items.append(URLQueryItem(name: "search", value: q)) }
        components.queryItems = items.isEmpty ? nil : items
        guard let url = components.url else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.timeoutInterval = 30
        return try await perform(req)
    }

    func createEmployee(_ emp: CreateEmployeeRequest) async throws -> Employee {
        let body = try encode(emp)
        let req = try makeRequest(method: "POST", path: "/api/employees/", body: body)
        return try await perform(req)
    }

    func updateEmployee(id: Int, emp: CreateEmployeeRequest) async throws -> Employee {
        let body = try encode(emp)
        let req = try makeRequest(method: "PUT", path: "/api/employees/\(id)", body: body)
        return try await perform(req)
    }

    func deleteEmployee(id: Int) async throws {
        let req = try makeRequest(method: "DELETE", path: "/api/employees/\(id)")
        try await performEmpty(req)
    }

    // MARK: - Analytics
    func getTaskAnalytics() async throws -> TaskAnalytics {
        let req = try makeRequest(method: "GET", path: "/api/analytics/tasks")
        return try await perform(req)
    }

    // MARK: - Todos
    func getTodos() async throws -> [Todo] {
        let req = try makeRequest(method: "GET", path: "/api/todos/")
        return try await perform(req)
    }

    func createTodo(_ todo: CreateTodoRequest) async throws -> Todo {
        let body = try encode(todo)
        let req = try makeRequest(method: "POST", path: "/api/todos/", body: body)
        return try await perform(req)
    }

    func updateTodo(id: Int, todo: CreateTodoRequest) async throws -> Todo {
        let body = try encode(todo)
        let req = try makeRequest(method: "PUT", path: "/api/todos/\(id)", body: body)
        return try await perform(req)
    }

    func deleteTodo(id: Int) async throws {
        let req = try makeRequest(method: "DELETE", path: "/api/todos/\(id)")
        try await performEmpty(req)
    }

    func completeTodo(id: Int) async throws -> Todo {
        struct Payload: Encodable { let status: String }
        let body = try encode(Payload(status: "Completed"))
        let req = try makeRequest(method: "PATCH", path: "/api/todos/\(id)/status", body: body)
        return try await perform(req)
    }

    // MARK: - Field Visits
    func getFieldVisits() async throws -> [FieldVisit] {
        let req = try makeRequest(method: "GET", path: "/api/field-visits/")
        return try await perform(req)
    }

    func createFieldVisit(_ visit: CreateFieldVisitRequest) async throws -> FieldVisit {
        let body = try encode(visit)
        let req = try makeRequest(method: "POST", path: "/api/field-visits/", body: body)
        return try await perform(req)
    }

    func updateFieldVisit(id: Int, visit: CreateFieldVisitRequest) async throws -> FieldVisit {
        let body = try encode(visit)
        let req = try makeRequest(method: "PUT", path: "/api/field-visits/\(id)", body: body)
        return try await perform(req)
    }

    func deleteFieldVisit(id: Int) async throws {
        let req = try makeRequest(method: "DELETE", path: "/api/field-visits/\(id)")
        try await performEmpty(req)
    }

    // MARK: - Planner
    func getPlannerEvents() async throws -> [PlannerEvent] {
        let req = try makeRequest(method: "GET", path: "/api/planner/")
        return try await perform(req)
    }

    // MARK: - Reviews
    func getReviews(departmentId: Int? = nil) async throws -> [ReviewSession] {
        var path = "/api/reviews/"
        if let d = departmentId { path += "?department_id=\(d)" }
        let req = try makeRequest(method: "GET", path: path)
        return try await perform(req)
    }
}
