import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Building2, ClipboardList, AlertTriangle, CheckCircle2,
    TrendingUp, Clock, CalendarCheck, ArrowRight, RefreshCw,
    Activity, Zap, Plus, Calendar, ChevronRight
} from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { api } from '../services/api';
import { format, parseISO, isAfter, isBefore, isToday } from 'date-fns';

const ReviewDebtBadge = ({ status }) => {
    const map = {
        ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
        critical: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
        no_programs: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
    };
    const labels = { ok: 'On Track', warning: 'Due Soon', critical: 'Overdue', no_programs: 'No Programs' };
    return (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${map[status] || map.no_programs}`}>
            {labels[status] || status}
        </span>
    );
};

const HealthBar = ({ score }) => {
    const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-rose-500';
    return (
        <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1, ease: 'circOut' }}
                className={`h-full ${color} rounded-full`}
            />
        </div>
    );
};

const colorMap = {
    indigo: 'from-indigo-500 to-indigo-700',
    emerald: 'from-emerald-500 to-emerald-700',
    amber: 'from-amber-500 to-amber-700',
    rose: 'from-rose-500 to-rose-700',
    sky: 'from-sky-500 to-sky-700',
    violet: 'from-violet-500 to-violet-700',
    teal: 'from-teal-500 to-teal-700',
    orange: 'from-orange-500 to-orange-700',
};

const sessionStatusDot = {
    Completed: 'bg-emerald-500',
    Scheduled: 'bg-indigo-500',
    Missed: 'bg-rose-500',
    Cancelled: 'bg-slate-300',
};

const Overview = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0 });
    const [allSessions, setAllSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [depts, stats, sessions] = await Promise.all([
                api.getDepartments(),
                api.getTaskStats(),
                api.getSessions(),
            ]);
            setDepartments(depts);
            setTaskStats(stats);
            setAllSessions(sessions);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const criticalDepts = departments.filter(d => d.review_health?.status === 'critical');
    const warningDepts = departments.filter(d => d.review_health?.status === 'warning');
    const healthyDepts = departments.filter(d => d.review_health?.status === 'ok');

    // Recent + upcoming sessions for the right panel
    const now = new Date();
    const recentSessions = [...allSessions]
        .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date))
        .slice(0, 8);

    const upcomingSessions = allSessions
        .filter(s => s.status === 'Scheduled' && isAfter(new Date(s.scheduled_date), now))
        .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
        .slice(0, 5);

    return (
        <Layout user={user} onLogout={onLogout}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tight">
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} 👋
                    </h1>
                    <p className="text-slate-500 dark:text-dark-muted mt-1 text-base">
                        {format(new Date(), 'EEEE, d MMMM yyyy')} — Governance Overview
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Task Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <StatCard title="Total Tasks" value={taskStats.total} icon={ClipboardList} color="indigo" delay={0} onClick={() => navigate('/tasks')} />
                <StatCard title="Completed" value={taskStats.completed} icon={CheckCircle2} color="green" delay={1} onClick={() => navigate('/tasks?status=Completed')} />
                <StatCard title="Pending" value={taskStats.pending} icon={Clock} color="yellow" delay={2} onClick={() => navigate('/tasks?status=Pending')} />
                <StatCard title="Overdue" value={taskStats.overdue} icon={AlertTriangle} color="red" delay={3} onClick={() => navigate('/tasks?status=Overdue')} />
            </div>

            {/* Review Health Alert Banner */}
            {(criticalDepts.length > 0 || warningDepts.length > 0) && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-8 p-5 rounded-2xl border flex items-start gap-4 ${criticalDepts.length > 0
                        ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20'
                        : 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'
                        }`}
                >
                    <AlertTriangle size={22} className={`${criticalDepts.length > 0 ? 'text-rose-500' : 'text-amber-500'} mt-0.5 shrink-0`} />
                    <div className="flex-1">
                        <p className={`font-bold text-sm ${criticalDepts.length > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                            Review Cadence Alert
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            {criticalDepts.length > 0 && `${criticalDepts.length} department${criticalDepts.length > 1 ? 's' : ''} have overdue reviews: ${criticalDepts.map(d => d.name).join(', ')}. `}
                            {warningDepts.length > 0 && `${warningDepts.length} department${warningDepts.length > 1 ? 's' : ''} due for review soon: ${warningDepts.map(d => d.name).join(', ')}.`}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/departments')}
                        className="ml-auto shrink-0 text-sm font-semibold text-indigo-600 flex items-center gap-1 hover:underline"
                    >
                        View <ArrowRight size={14} />
                    </button>
                </motion.div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
                {/* ── Department Health Grid ── */}
                <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-black dark:text-white">Department Review Health</h2>
                        <button
                            onClick={() => navigate('/departments')}
                            className="text-sm font-semibold text-indigo-600 flex items-center gap-1 hover:underline"
                        >
                            All Departments <ArrowRight size={14} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="glass-card rounded-2xl p-5 animate-pulse h-24" />
                            ))}
                        </div>
                    ) : departments.length === 0 ? (
                        <div className="glass-card rounded-2xl p-10 text-center">
                            <Building2 size={40} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-semibold">No departments yet</p>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => navigate('/departments')}
                                    className="mt-3 text-sm text-indigo-600 font-bold hover:underline"
                                >
                                    Add your first department →
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {departments.map((dept, i) => {
                                // Match sessions by department_id (robust) or fall back to department_name
                                const deptSessions = allSessions.filter(s =>
                                    s.department_name === dept.name
                                );
                                const pastSessions = deptSessions
                                    .filter(s => s.status === 'Completed' || isBefore(new Date(s.scheduled_date), now))
                                    .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));
                                const futureSessions = deptSessions
                                    .filter(s => s.status === 'Scheduled' && isAfter(new Date(s.scheduled_date), now))
                                    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

                                return (
                                    <motion.div
                                        key={dept.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="glass-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                                    >
                                        {/* Dept header row */}
                                        <div
                                            className="p-4 border-b border-slate-100 dark:border-white/5 cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                            onClick={() => navigate(`/departments/${dept.id}`)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[dept.color] || colorMap.indigo} flex items-center justify-center shrink-0 shadow-lg`}>
                                                    <span className="text-white font-bold text-sm">
                                                        {dept.short_name || dept.name.slice(0, 2).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors">{dept.name}</h3>
                                                    {dept.review_health?.days_since_last_review != null ? (
                                                        <p className="text-xs text-slate-400">Last reviewed: {dept.review_health.days_since_last_review} days ago</p>
                                                    ) : (
                                                        <p className="text-xs text-slate-300 italic">No reviews yet</p>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300 dark:text-white/20" />
                                        </div>

                                        {/* Reviews done row */}
                                        <div className="flex w-full border-b border-slate-100 dark:border-white/5 text-sm divide-x divide-slate-100 dark:divide-white/5 bg-slate-50/30 dark:bg-white/2">
                                            <div className="font-black text-slate-500 dark:text-slate-400 py-2.5 px-4 w-32 shrink-0 flex items-center text-[10px] uppercase tracking-wider bg-white/60 dark:bg-white/3">
                                                Reviews
                                            </div>
                                            <div className="flex-1 flex overflow-x-auto">
                                                {pastSessions.slice(0, 4).map((session) => (
                                                    <div
                                                        key={session.id}
                                                        className="px-3 py-2.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer border-r border-slate-100 dark:border-white/5 shrink-0 flex flex-col items-center justify-center min-w-[80px] transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/reviews/${session.id}`); }}
                                                    >
                                                        <span className="text-xs font-bold">{format(new Date(session.scheduled_date), 'dd/MM/yy')}</span>
                                                        <span className={`text-[9px] mt-0.5 font-bold uppercase tracking-wide ${session.status === 'Completed' ? 'text-emerald-500' : session.status === 'Missed' ? 'text-rose-400' : 'text-slate-400'}`}>
                                                            {session.status}
                                                        </span>
                                                    </div>
                                                ))}
                                                {futureSessions.slice(0, 1).map(session => (
                                                    <div
                                                        key={session.id}
                                                        className="px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer border-r border-slate-100 dark:border-white/5 shrink-0 flex flex-col items-center justify-center min-w-[80px] transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/reviews/${session.id}`); }}
                                                    >
                                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{format(new Date(session.scheduled_date), 'dd/MM/yy')}</span>
                                                        <span className="text-[9px] mt-0.5 font-bold uppercase tracking-wide text-indigo-400">Upcoming</span>
                                                    </div>
                                                ))}
                                                {deptSessions.length === 0 && (
                                                    <div className="px-4 py-2.5 text-xs text-slate-300 dark:text-white/20 italic flex items-center">
                                                        No reviews scheduled
                                                    </div>
                                                )}
                                                <div className="flex-1" />
                                            </div>
                                            {/* Next review */}
                                            <div className="py-2 px-3 shrink-0 flex items-center justify-center bg-white/60 dark:bg-white/3 min-w-[90px]">
                                                <div className="text-center">
                                                    <p className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Next</p>
                                                    <p className="font-bold text-slate-700 dark:text-white text-xs mt-0.5">
                                                        {dept.review_health?.next_scheduled
                                                            ? format(new Date(dept.review_health.next_scheduled), 'dd/MM/yy')
                                                            : futureSessions[0]
                                                                ? format(new Date(futureSessions[0].scheduled_date), 'dd/MM/yy')
                                                                : '—'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Health row */}
                                        <div className="flex w-full text-sm divide-x divide-slate-100 dark:divide-white/5 bg-slate-50/10 dark:bg-transparent">
                                            <div className="font-black text-slate-500 dark:text-slate-400 py-2.5 px-4 w-32 shrink-0 flex items-center text-[10px] uppercase tracking-wider bg-white/60 dark:bg-white/3">
                                                Health
                                            </div>
                                            <div className="flex-1 flex items-center px-4 py-2.5 gap-4">
                                                <div className="flex-1 max-w-xs">
                                                    <HealthBar score={dept.review_health?.score || 0} />
                                                </div>
                                                <ReviewDebtBadge status={dept.review_health?.status} />
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Right Panel ── */}
                <div className="space-y-5">
                    {/* Quick Stats */}
                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={16} className="text-indigo-600" />
                            <h3 className="font-black text-slate-800 dark:text-white text-sm">Quick Stats</h3>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: 'Departments', value: departments.length, color: 'text-slate-700 dark:text-white' },
                                { label: 'Critical', value: criticalDepts.length, color: 'text-rose-600' },
                                { label: 'Needs Attention', value: warningDepts.length, color: 'text-amber-600' },
                                { label: 'On Track', value: healthyDepts.length, color: 'text-emerald-600' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500">{label}</span>
                                    <span className={`font-black text-lg ${color}`}>{value}</span>
                                </div>
                            ))}
                            {taskStats.total > 0 && (
                                <div className="border-t border-slate-100 dark:border-white/10 pt-3 mt-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500">Task Completion</span>
                                        <span className="font-black text-indigo-600 text-lg">
                                            {Math.round((taskStats.completed / taskStats.total) * 100)}%
                                        </span>
                                    </div>
                                    <div className="mt-2 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(taskStats.completed / taskStats.total) * 100}%` }}
                                            transition={{ duration: 1, ease: 'circOut', delay: 0.3 }}
                                            className="h-full bg-indigo-600 rounded-full"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Upcoming Reviews */}
                    {upcomingSessions.length > 0 && (
                        <div className="glass-card rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-indigo-600" />
                                    <h3 className="font-black text-slate-800 dark:text-white text-sm">Upcoming Reviews</h3>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {upcomingSessions.map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => navigate(`/reviews/${session.id}`)}
                                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 cursor-pointer transition-colors group"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-white truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                                                {session.program_name}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">{session.department_name}</p>
                                        </div>
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                            {format(new Date(session.scheduled_date), 'd MMM')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All Recent Reviews */}
                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <CalendarCheck size={16} className="text-indigo-600" />
                                <h3 className="font-black text-slate-800 dark:text-white text-sm">All Reviews</h3>
                            </div>
                            <span className="text-xs text-slate-400 font-semibold">{allSessions.length} total</span>
                        </div>
                        {recentSessions.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4 italic">No reviews scheduled yet</p>
                        ) : (
                            <div className="space-y-1.5">
                                {recentSessions.map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => navigate(`/reviews/${session.id}`)}
                                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                                    >
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${sessionStatusDot[session.status] || 'bg-slate-300'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                {session.program_name}
                                            </p>
                                            <p className="text-[10px] text-slate-400 truncate">{session.department_name}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] text-slate-400">
                                                {format(new Date(session.scheduled_date), 'd MMM')}
                                            </p>
                                            <p className={`text-[9px] font-bold uppercase tracking-wide ${session.status === 'Completed' ? 'text-emerald-500' : session.status === 'Scheduled' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                {session.status}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {allSessions.length > 8 && (
                                    <p className="text-xs text-center text-indigo-600 font-semibold pt-1 cursor-pointer hover:underline" onClick={() => navigate('/departments')}>
                                        View all in Departments →
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap size={16} className="text-indigo-600" />
                            <h3 className="font-black text-slate-800 dark:text-white text-sm">Quick Actions</h3>
                        </div>
                        <div className="space-y-2">
                            <button
                                onClick={() => navigate('/departments')}
                                className="w-full text-left px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors flex items-center justify-between group"
                            >
                                Manage Departments
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => navigate('/tasks')}
                                className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex items-center justify-between group"
                            >
                                View All Tasks
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => navigate('/planner')}
                                    className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex items-center justify-between group"
                                >
                                    Weekly Planner
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Overview;
