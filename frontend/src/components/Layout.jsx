import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard, Building2, ClipboardList, Calendar, LogOut,
    Sun, Moon, Menu, ChevronRight, Users
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Layout = ({ children, user, onLogout }) => {
    const [isDark, setIsDark] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.classList.toggle('dark');
    };

    const menuItems = [
        { icon: LayoutDashboard, label: 'Overview', path: '/' },
        { icon: Building2, label: 'Departments', path: '/departments' },
        { icon: ClipboardList, label: 'Tasks', path: '/tasks' },
        ...(user?.role === 'admin' ? [
            { icon: Users, label: 'Employees', path: '/employees' },
            { icon: Calendar, label: 'Planner', path: '/planner' },
        ] : []),
    ];

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <div className={`min-h-screen flex transition-colors duration-500 overflow-hidden relative ${isDark ? 'dark bg-dark-bg' : 'bg-slate-50'}`}>
            {/* Ambient Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none z-0"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-violet-500/5 dark:bg-violet-500/10 blur-[100px] rounded-full pointer-events-none z-0"></div>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: sidebarOpen ? 260 : 88 }}
                className="glass-card border-r border-slate-200/60 dark:border-white/5 fixed h-full z-30 hidden md:flex flex-col shadow-premium-lg"
            >
                {/* Logo */}
                <div className="p-7 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-700 to-violet-700 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                        <span className="text-white font-bold text-xl">G</span>
                    </div>
                    {sidebarOpen && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <span className="font-bold text-lg premium-gradient-text tracking-tight block leading-tight">Governance</span>
                            <span className="text-xs text-slate-400 font-medium">District Dashboard</span>
                        </motion.div>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {menuItems.map((item) => (
                        <button
                            key={item.label}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-premium group relative ${isActive(item.path)
                                    ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-500/25'
                                    : 'text-slate-500 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                        >
                            <item.icon size={20} className="transition-transform group-hover:scale-110 shrink-0" />
                            {sidebarOpen && <span className="font-semibold text-sm tracking-wide">{item.label}</span>}
                            {sidebarOpen && isActive(item.path) && (
                                <ChevronRight size={14} className="ml-auto opacity-60" />
                            )}
                        </button>
                    ))}
                </nav>

                {/* Bottom Controls */}
                <div className="p-5 border-t premium-border space-y-3">
                    {sidebarOpen && user && (
                        <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Logged in as</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-white mt-0.5 capitalize">{user.username}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                                }`}>{user.role}</span>
                        </div>
                    )}
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-premium group"
                    >
                        <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                        {sidebarOpen && <span className="font-semibold text-sm">Logout</span>}
                    </button>

                    <div className="flex items-center justify-between px-2 pt-1">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 dark:text-dark-muted transition-colors"
                        >
                            <Menu size={20} />
                        </button>
                        {sidebarOpen && (
                            <button
                                onClick={toggleTheme}
                                className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 dark:text-dark-muted transition-colors"
                            >
                                {isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
                            </button>
                        )}
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className={`flex-1 ${sidebarOpen ? 'md:ml-[260px]' : 'md:ml-[88px]'} transition-all duration-500 p-6 md:p-10 overflow-y-auto custom-scrollbar relative z-10`}>
                {/* Mobile Header */}
                <div className="md:hidden flex justify-between items-center mb-8 glass-card p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-700 to-violet-700 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">G</span>
                        </div>
                        <span className="text-lg font-bold premium-gradient-text">Governance</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-white/5 shadow-sm">
                            {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
                        </button>
                        <button onClick={onLogout} className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-white/5 shadow-sm text-red-500">
                            <LogOut size={18} />
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
