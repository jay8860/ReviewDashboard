import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Building2, ClipboardList, Calendar, LogOut,
    Sun, Moon, Menu, ChevronRight, Users, X, CheckSquare, Map, ShieldCheck, BarChart3
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { canAccessModule } from '../utils/access';

const Layout = ({ children, user, onLogout }) => {
    const [isDark, setIsDark] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.classList.toggle('dark');
    };

    const menuItems = [
        { icon: LayoutDashboard, label: 'Overview', path: '/', desc: 'Dashboard home', module: 'overview' },
        { icon: ClipboardList, label: 'Tasks', path: '/tasks', desc: 'Action tracking', module: 'tasks' },
        { icon: Building2, label: 'Departments', path: '/departments', desc: 'Dept. & reviews', module: 'departments' },
        { icon: Map, label: 'Field Visits', path: '/field-visits', desc: 'Village visit drafts', module: 'field_visits' },
        { icon: CheckSquare, label: 'To Do List', path: '/todos', desc: 'Personal reminders', module: 'todos' },
        { icon: Calendar, label: 'Planner', path: '/planner', desc: 'Weekly planner', module: 'planner' },
        { icon: BarChart3, label: 'Analytics', path: '/analytics', desc: 'Command center', module: 'analytics' },
        { icon: Users, label: 'Employees', path: '/employees', desc: 'Team directory', module: 'employees' },
        ...(user?.role === 'admin' ? [{ icon: ShieldCheck, label: 'Access Module', path: '/access', desc: 'Users & access' }] : []),
    ].filter((item) => !item.module || canAccessModule(user, item.module));

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const NavItem = ({ item, collapsed }) => (
        <button
            onClick={() => { navigate(item.path); setMobileOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${isActive(item.path)
                ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-500 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
        >
            <item.icon
                size={20}
                className={`transition-transform group-hover:scale-110 shrink-0 ${isActive(item.path) ? 'text-white' : ''}`}
            />
            {!collapsed && (
                <div className="flex-1 text-left min-w-0">
                    <span className="font-semibold text-sm tracking-wide block">{item.label}</span>
                    {item.desc && !isActive(item.path) && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-indigo-400 transition-colors">{item.desc}</span>
                    )}
                </div>
            )}
            {!collapsed && isActive(item.path) && (
                <ChevronRight size={14} className="ml-auto opacity-60 shrink-0" />
            )}
        </button>
    );

    return (
        <div className={`min-h-screen flex transition-colors duration-500 overflow-hidden relative ${isDark ? 'dark bg-dark-bg' : 'bg-slate-50'}`}>
            {/* Ambient Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-violet-500/5 dark:bg-violet-500/10 blur-[100px] rounded-full pointer-events-none z-0" />

            {/* ── Desktop Sidebar ── */}
            <motion.aside
                initial={false}
                animate={{ width: sidebarOpen ? 260 : 80 }}
                transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                className="glass-card border-r border-slate-200/60 dark:border-white/5 fixed h-full z-30 hidden md:flex flex-col shadow-premium overflow-hidden"
            >
                {/* Logo */}
                <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-700 to-violet-700 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                        <span className="text-white font-bold text-xl">G</span>
                    </div>
                    {sidebarOpen && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 }}
                        >
                            <span className="font-bold text-lg premium-gradient-text tracking-tight block leading-tight">Governance</span>
                            <span className="text-xs text-slate-400 font-medium">Review Dashboard</span>
                        </motion.div>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {/* Section label */}
                    {sidebarOpen && (
                        <p className="text-[10px] font-black text-slate-300 dark:text-white/20 uppercase tracking-widest px-4 pb-2">Navigation</p>
                    )}
                    {menuItems.map(item => (
                        <NavItem key={item.label} item={item} collapsed={!sidebarOpen} />
                    ))}
                </nav>

                {/* Bottom Controls */}
                <div className="p-4 border-t border-slate-100 dark:border-white/5 space-y-2">
                    {/* User badge */}
                    {sidebarOpen && user && (
                        <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 mb-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logged in as</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-white mt-0.5 capitalize">{user.username}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 inline-block uppercase tracking-wider ${user.role === 'admin'
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                                }`}>
                                {user.role}
                            </span>
                        </div>
                    )}

                    {/* Logout */}
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all group"
                    >
                        <LogOut size={18} className="group-hover:-translate-x-1 transition-transform shrink-0" />
                        {sidebarOpen && <span className="font-semibold text-sm">Logout</span>}
                    </button>

                    {/* Collapse + Theme toggles */}
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-colors flex-1 flex justify-center"
                            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                        >
                            <Menu size={18} />
                        </button>
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-colors flex-1 flex justify-center"
                            title="Toggle theme"
                        >
                            {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
                        </button>
                    </div>
                </div>
            </motion.aside>

            {/* ── Mobile Sidebar Overlay ── */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                            className="fixed left-0 top-0 h-full w-[260px] glass-card border-r border-slate-200/60 dark:border-white/5 z-50 flex flex-col shadow-2xl md:hidden"
                        >
                            <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-700 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                        <span className="text-white font-bold text-lg">G</span>
                                    </div>
                                    <span className="font-bold text-lg premium-gradient-text">Governance</span>
                                </div>
                                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                                    <X size={18} />
                                </button>
                            </div>
                            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                                {menuItems.map(item => (
                                    <NavItem key={item.label} item={item} collapsed={false} />
                                ))}
                            </nav>
                            {user && (
                                <div className="p-4 border-t border-slate-100 dark:border-white/5">
                                    <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 mb-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logged in as</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-white mt-0.5 capitalize">{user.username}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={toggleTheme} className="flex-1 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 flex justify-center">
                                            {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
                                        </button>
                                        <button onClick={onLogout} className="flex-1 p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 flex justify-center">
                                            <LogOut size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── Main Content ── */}
            <main
                className={`flex-1 transition-all duration-500 p-6 md:p-10 overflow-y-auto custom-scrollbar relative z-10 ${sidebarOpen ? 'md:ml-[260px]' : 'md:ml-[80px]'}`}
            >
                {/* Mobile Header */}
                <div className="md:hidden flex justify-between items-center mb-6 glass-card p-4 rounded-2xl">
                    <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500">
                        <Menu size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-700 to-violet-700 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">G</span>
                        </div>
                        <span className="text-base font-bold premium-gradient-text">Governance</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-white/5 text-slate-500">
                            {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
                        </button>
                        <button onClick={onLogout} className="p-2 rounded-xl bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-white/5 text-red-500">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>

                <div className="w-full">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
