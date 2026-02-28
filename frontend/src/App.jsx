import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Departments from './pages/Departments';
import DepartmentDetail from './pages/DepartmentDetail';
import MeetingWorkspace from './pages/MeetingWorkspace';
import ReviewDetail from './pages/ReviewDetail';
import Tasks from './pages/Tasks';
import Planner from './pages/Planner';
import Employees from './pages/Employees';
import ResetPassword from './pages/ResetPassword';

const ProtectedRoute = ({ children, user }) => {
    if (!user) return <Navigate to="/login" replace />;
    return children;
};

const AdminRoute = ({ children, user }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'admin') return <Navigate to="/" replace />;
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
                    user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />
                } />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={
                    <ProtectedRoute user={user}>
                        <Overview user={user} onLogout={handleLogout} />
                    </ProtectedRoute>
                } />
                <Route path="/departments" element={
                    <ProtectedRoute user={user}>
                        <Departments user={user} onLogout={handleLogout} />
                    </ProtectedRoute>
                } />
                <Route path="/departments/:deptId" element={
                    <ProtectedRoute user={user}>
                        <DepartmentDetail user={user} onLogout={handleLogout} />
                    </ProtectedRoute>
                } />
                <Route path="/departments/:deptId/meetings/:meetingId" element={
                    <ProtectedRoute user={user}>
                        <MeetingWorkspace user={user} onLogout={handleLogout} />
                    </ProtectedRoute>
                } />
                <Route path="/reviews/:sessionId" element={
                    <ProtectedRoute user={user}>
                        <ReviewDetail user={user} onLogout={handleLogout} />
                    </ProtectedRoute>
                } />
                <Route path="/tasks" element={
                    <ProtectedRoute user={user}>
                        <Tasks user={user} onLogout={handleLogout} />
                    </ProtectedRoute>
                } />
                <Route path="/planner" element={
                    <AdminRoute user={user}>
                        <Planner user={user} onLogout={handleLogout} />
                    </AdminRoute>
                } />
                <Route path="/employees" element={
                    <AdminRoute user={user}>
                        <Employees user={user} onLogout={handleLogout} />
                    </AdminRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
