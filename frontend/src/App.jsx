import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { canAccessModule, getDefaultPathForUser } from './utils/access';
import { api } from './services/api';

const lazyRetry = (importer) => lazy(async () => {
    try {
        return await importer();
    } catch (error) {
        const key = 'reviewdashboard:lazy-retry';
        if (typeof window !== 'undefined' && !window.sessionStorage.getItem(key)) {
            window.sessionStorage.setItem(key, '1');
            window.location.reload();
            return new Promise(() => {});
        }
        throw error;
    }
});

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error) {
        console.error('App route render failed', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
                    <div className="max-w-md text-center">
                        <h1 className="text-2xl font-bold text-slate-900 mb-3">Dashboard needs a refresh</h1>
                        <p className="text-slate-600 mb-5">A page failed to load correctly. Refresh once to restore the session.</p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                            Refresh dashboard
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const Login = lazyRetry(() => import('./pages/Login'));
const Overview = lazyRetry(() => import('./pages/Overview'));
const Departments = lazyRetry(() => import('./pages/Departments'));
const DepartmentDetail = lazyRetry(() => import('./pages/DepartmentDetail'));
const MeetingWorkspace = lazyRetry(() => import('./pages/MeetingWorkspace'));
const DocumentAnalysisWorkspace = lazyRetry(() => import('./pages/DocumentAnalysisWorkspace'));
const ReviewDetail = lazyRetry(() => import('./pages/ReviewDetail'));
const Tasks = lazyRetry(() => import('./pages/Tasks'));
const Analytics = lazyRetry(() => import('./pages/Analytics'));
const Planner = lazyRetry(() => import('./pages/Planner'));
const Employees = lazyRetry(() => import('./pages/Employees'));
const ResetPassword = lazyRetry(() => import('./pages/ResetPassword'));
const FieldVisits = lazyRetry(() => import('./pages/FieldVisits'));
const Todos = lazyRetry(() => import('./pages/Todos'));
const AccessModule = lazyRetry(() => import('./pages/AccessModule'));
const Audit = lazyRetry(() => import('./pages/Audit'));
const GeneralInfo = lazyRetry(() => import('./pages/GeneralInfo'));

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
    const [authReady, setAuthReady] = useState(false);
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch {
            return null;
        }
    });

    useEffect(() => {
        let active = true;

        const verifySession = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                if (active) setAuthReady(true);
                return;
            }

            try {
                const currentUser = await api.getCurrentUser();
                if (!active) return;
                localStorage.setItem('user', JSON.stringify(currentUser));
                setUser(currentUser);
            } catch {
                if (!active) return;
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setUser(null);
            } finally {
                if (active) setAuthReady(true);
            }
        };

        verifySession();
        return () => {
            active = false;
        };
    }, []);

    const handleLogin = (userData) => {
        // Login.jsx already saves token/user to localStorage before calling this
        setUser(userData);
        setAuthReady(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setAuthReady(true);
    };

    if (!authReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-semibold">
                Loading dashboard...
            </div>
        );
    }

    return (
        <BrowserRouter>
            <AppErrorBoundary>
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
                        <Route path="/general-info" element={
                            <ModuleRoute user={user} moduleKey="general_info">
                                <GeneralInfo user={user} onLogout={handleLogout} />
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
                        <Route path="/audit" element={
                            <AdminRoute user={user}>
                                <Audit user={user} onLogout={handleLogout} />
                            </AdminRoute>
                        } />
                        <Route path="/access" element={
                            <AdminRoute user={user}>
                                <AccessModule user={user} onLogout={handleLogout} />
                            </AdminRoute>
                        } />
                        <Route path="*" element={<Navigate to={getDefaultPathForUser(user)} replace />} />
                    </Routes>
                </Suspense>
            </AppErrorBoundary>
        </BrowserRouter>
    );
}

export default App;
