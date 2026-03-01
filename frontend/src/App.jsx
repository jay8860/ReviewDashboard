import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Departments from './pages/Departments';
import DepartmentDetail from './pages/DepartmentDetail';
import MeetingWorkspace from './pages/MeetingWorkspace';
import DocumentAnalysisWorkspace from './pages/DocumentAnalysisWorkspace';
import ReviewDetail from './pages/ReviewDetail';
import Tasks from './pages/Tasks';
import Analytics from './pages/Analytics';
import Planner from './pages/Planner';
import Employees from './pages/Employees';
import ResetPassword from './pages/ResetPassword';
import FieldVisits from './pages/FieldVisits';
import Todos from './pages/Todos';
import AccessModule from './pages/AccessModule';
import { canAccessModule, getDefaultPathForUser } from './utils/access';

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
        </BrowserRouter>
    );
}

export default App;
