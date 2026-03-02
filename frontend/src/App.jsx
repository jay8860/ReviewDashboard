import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { canAccessModule, getDefaultPathForUser } from './utils/access';

const Login = lazy(() => import('./pages/Login'));
const Overview = lazy(() => import('./pages/Overview'));
const Departments = lazy(() => import('./pages/Departments'));
const DepartmentDetail = lazy(() => import('./pages/DepartmentDetail'));
const MeetingWorkspace = lazy(() => import('./pages/MeetingWorkspace'));
const DocumentAnalysisWorkspace = lazy(() => import('./pages/DocumentAnalysisWorkspace'));
const ReviewDetail = lazy(() => import('./pages/ReviewDetail'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Planner = lazy(() => import('./pages/Planner'));
const Employees = lazy(() => import('./pages/Employees'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const FieldVisits = lazy(() => import('./pages/FieldVisits'));
const Todos = lazy(() => import('./pages/Todos'));
const AccessModule = lazy(() => import('./pages/AccessModule'));

const AdminRoute = ({ children, user }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'admin') return <Navigate to="/" replace />;
    return children;
};

const ModuleRoute = ({ children, user, moduleKey }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (!canAccessModule(user, moduleKey)) {
        return <Navigate to={getDefaultPathForUser(user)} replace />;
    }
    return children;
};

function App() {
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch {
            return null;
        }
    });

    const handleLogin = (userData) => {
        // Login.jsx already saves token/user to localStorage before calling this
        setUser(userData);
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <BrowserRouter>
            <Suspense
                fallback={
                    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-semibold">
                        Loading dashboard...
                    </div>
                }
            >
                <Routes>
                    <Route path="/login" element={
                        user ? <Navigate to={getDefaultPathForUser(user)} replace /> : <Login onLogin={handleLogin} />
                    } />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/" element={
                        <ModuleRoute user={user} moduleKey="overview">
                            <Overview user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/departments" element={
                        <ModuleRoute user={user} moduleKey="departments">
                            <Departments user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/departments/:deptId" element={
                        <ModuleRoute user={user} moduleKey="departments">
                            <DepartmentDetail user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/departments/:deptId/meetings/:meetingId" element={
                        <ModuleRoute user={user} moduleKey="departments">
                            <MeetingWorkspace user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/departments/:deptId/documents/:docId/analysis" element={
                        <ModuleRoute user={user} moduleKey="departments">
                            <DocumentAnalysisWorkspace user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/departments/:deptId/meetings/:meetingId/documents/:docId/analysis" element={
                        <ModuleRoute user={user} moduleKey="departments">
                            <DocumentAnalysisWorkspace user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/reviews/:sessionId" element={
                        <ModuleRoute user={user} moduleKey="departments">
                            <ReviewDetail user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/tasks" element={
                        <ModuleRoute user={user} moduleKey="tasks">
                            <Tasks user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/analytics" element={
                        <ModuleRoute user={user} moduleKey="analytics">
                            <Analytics user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/field-visits" element={
                        <ModuleRoute user={user} moduleKey="field_visits">
                            <FieldVisits user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/todos" element={
                        <ModuleRoute user={user} moduleKey="todos">
                            <Todos user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/planner" element={
                        <ModuleRoute user={user} moduleKey="planner">
                            <Planner user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/employees" element={
                        <ModuleRoute user={user} moduleKey="employees">
                            <Employees user={user} onLogout={handleLogout} />
                        </ModuleRoute>
                    } />
                    <Route path="/access" element={
                        <AdminRoute user={user}>
                            <AccessModule user={user} onLogout={handleLogout} />
                        </AdminRoute>
                    } />
                    <Route path="*" element={<Navigate to={getDefaultPathForUser(user)} replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}

export default App;
