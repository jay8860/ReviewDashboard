# Review Dashboard — iOS App

A fully native SwiftUI iOS app for the District Administration Review Dashboard portal.

## Requirements
- **Xcode 15+** (macOS)
- **iOS 16.0+** deployment target
- **Swift 5.9+**
- Active internet connection (connects to Railway backend)

## Backend
The app connects to: `https://reviewdashboard-production.up.railway.app`

All API calls use Bearer JWT authentication stored securely in `UserDefaults`.

---

## How to Open in Xcode

1. Open **Xcode**
2. Go to **File → Open**
3. Navigate to this folder and select **`ReviewDashboard.xcodeproj`**
4. Xcode will load the project

---

## How to Run

### On Simulator
1. Open the project in Xcode
2. Select a simulator (e.g. **iPhone 15 Pro**) from the scheme dropdown
3. Press **⌘R** or click the Play button
4. The app will build and launch in the simulator

### On a Real Device
1. Connect your iPhone via USB
2. Select your device from the scheme dropdown
3. Set your **Apple Developer Team** in:
   `Target → ReviewDashboard → Signing & Capabilities → Team`
4. Press **⌘R** to build and run

---

## Project Structure

```
ReviewDashboardiOS/
├── ReviewDashboard.xcodeproj/
│   └── project.pbxproj
└── ReviewDashboard/
    ├── ReviewDashboardApp.swift       ← App entry point
    ├── Info.plist
    ├── Models/
    │   └── Models.swift               ← All data models (Codable)
    ├── Services/
    │   ├── APIService.swift           ← All API calls (async/await)
    │   └── AuthManager.swift          ← Login state + token storage
    └── Views/
        ├── MainTabView.swift          ← Tab bar + Profile + More
        ├── Components/
        │   └── SharedComponents.swift ← Reusable UI (cards, badges, etc.)
        ├── Auth/
        │   └── LoginView.swift        ← Login + Forgot Password
        ├── Overview/
        │   └── OverviewView.swift     ← Dashboard home
        ├── Tasks/
        │   └── TasksView.swift        ← Full task management (CRUD)
        ├── Departments/
        │   └── DepartmentsView.swift  ← Departments + detail view
        ├── Employees/
        │   └── EmployeesView.swift    ← Employee management
        ├── Analytics/
        │   └── AnalyticsView.swift    ← Charts + stats
        ├── Todos/
        │   └── TodosView.swift        ← To-do list (CRUD)
        └── FieldVisits/
            └── FieldVisitsView.swift  ← Field visits (CRUD)
```

---

## Features

| Feature | Details |
|---|---|
| **Login** | Username/password with hint, forgot password |
| **Overview** | Stats grid, today's tasks, dept review health, quick access |
| **Tasks** | Filter by status/priority, search, create/edit/delete, mark complete |
| **Departments** | Grouped by category, review health ticker, department detail |
| **Employees** | Search, filter by dept, avatar initials, create/edit/delete |
| **Analytics** | Charts (iOS 16 native Charts), dept health, workload, agency perf |
| **Field Visits** | Filter by status, schedule/edit/delete visits |
| **To-Do List** | Pending/Completed sections, complete with one tap |
| **Planner** | Read-only event list |
| **Profile** | User info, module access, sign out |
| **Role-based access** | Module access respects user permissions |

---

## Authentication Flow

1. User enters username + password → `POST /api/auth/login`
2. JWT token stored in `UserDefaults` under key `auth_token`
3. User object stored in `UserDefaults` under key `current_user`
4. All subsequent requests include `Authorization: Bearer <token>`
5. 401 responses automatically trigger logout

---

## Troubleshooting

**Build fails with "No such module 'Charts'"**
→ Charts is a built-in Apple framework since iOS 16. Make sure deployment target is set to iOS 16.0+.

**App shows "Session expired"**
→ Your JWT token has expired. Log out and log back in.

**Signing error**
→ Set your Apple Developer Team in Target Settings → Signing & Capabilities.

**Network requests fail**
→ Check that the Railway backend is running at the configured URL.
