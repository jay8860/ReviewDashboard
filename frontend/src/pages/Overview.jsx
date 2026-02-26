import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Building2, ClipboardList, AlertTriangle, CheckCircle2,
    TrendingUp, Clock, CalendarCheck, ArrowRight, RefreshCw,
    Activity, Zap
} from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { api } from '../services/api';
import { format } from 'date-fns';

const ReviewDebtBadge = ({ status }) => {
    const map = {
        ok: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700',
        critical: 'bg-rose-100 text-rose-700',
        no_programs: 'bg-slate-100 text-slate-500',
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

const Overview = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0 });
    const [recentSessions, setRecentSessions] = useState([]);
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
            // Sort sessions — most recent first, limit 5
            const sorted = [...sessions].sort((a, b) =>
                new Date(b.scheduled_date) - new Date(a.scheduled_date)
            ).slice(0, 5);
            setRecentSessions(sorted);
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

    return (
        <Layout user={user} onLogout={onLogout}>
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
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
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Task Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
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
                    <AlertTriangle size={22} className={criticalDepts.length > 0 ? 'text-rose-500 mt-0.5 shrink-0' : 'text-amber-500 mt-0.5 shrink-0'} />
                    <div>
                        <p className={`font-bold text-sm ${criticalDepts.length > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                            Review Cadence Alert
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                            {criticalDepts.length > 0 && `${criticalDepts.length} department${criticalDepts.length > 1 ? 's' : ''} ${criticalDepts.length > 1 ? 'have' : 'has'} overdue reviews: ${criticalDepts.map(d => d.name).join(', ')}. `}
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
                {/* Department Health Grid */}
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
                                <div key={i} className="glass-card rounded-2xl p-5 animate-pulse h-20" />
                            ))}
                        </div>
                    ) : departments.length === 0 ? (
                        <div className="glass-card rounded-2xl p-10 text-center">
                            <Building2 size={40} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-semibold">No departments yet</p>
                            <button
                                onClick={() => navigate('/departments')}
                                className="mt-3 text-sm text-indigo-600 font-bold hover:underline"
                            >
                                Add your first department →
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {departments.map((dept, i) => {
                                // Extract past and future sessions for this department
                                // We'll look at the review programs to gather sessions
                                const allDeptSessions = recentSessions.filter(s => s.department_name === dept.name);
                                const pastSessions = allDeptSessions.filter(s => new Date(s.scheduled_date) <= new Date()).sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));
                                const futureSessions = allDeptSessions.filter(s => new Date(s.scheduled_date) > new Date()).sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

                                return (
                                    <motion.div
                                        key={dept.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="glass-card rounded-2xl overflow-hidden shadow-premium hover:shadow-premium-lg transition-premium group"
                                    >
                                        <div className="p-4 border-b border-slate-100 dark:border-white/5 cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => navigate(`/departments/${dept.id}`)}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[dept.color] || colorMap.indigo} flex items-center justify-center shrink-0 shadow-lg`}>
                                                    <span className="text-white font-bold text-sm">
                                                        {dept.short_name || dept.name.slice(0, 2).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-slate-800 dark:text-white text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{dept.name}</h3>
                                                    {dept.review_health?.days_since_last_review !== undefined && dept.review_health?.days_since_last_review !== null && (
                                                        <p className="text-xs text-slate-400">(Review last : {dept.review_health.days_since_last_review} days)</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50/50 dark:bg-dark-card/30 flex w-full border-t border-slate-100 dark:border-white/5 text-sm divide-x divide-slate-200 dark:divide-white/10">
                                            <div className="font-black text-slate-700 dark:text-slate-300 py-3 px-4 w-32 shrink-0 flex items-center text-xs uppercase tracking-wider bg-white dark:bg-white/5">
                                                Reviews done
                                            </div>
                                            <div className="flex-1 flex overflow-x-auto custom-scrollbar">
                                                {pastSessions.slice(0, 3).map((session, idx) => (
                                                    <div
                                                        key={session.id}
                                                        className="px-4 py-3 font-bold text-slate-800 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer border-r border-slate-200 dark:border-white/10 shrink-0 flex items-center justify-center min-w-[100px] transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/reviews/${session.id}`); }}
                                                    >
                                                        {format(new Date(session.scheduled_date), 'dd/MM/yy')}
                                                    </div>
                                                ))}
                                                {futureSessions.slice(0, 1).map(session => (
                                                    <div
                                                        key={session.id}
                                                        className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer border-r border-slate-200 dark:border-white/10 shrink-0 flex items-center justify-center min-w-[100px] transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/reviews/${session.id}`); }}
                                                    >
                                                        {format(new Date(session.scheduled_date), 'dd/MM/yy')} →
                                                    </div>
                                                ))}
                                                <div className="flex-1 min-w-[20px]"></div>
                                            </div>
                                            <div className="py-2 px-4 shrink-0 flex items-center justify-center bg-white dark:bg-white/5">
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Next review</p>
                                                    <p className="font-bold text-slate-800 dark:text-white">
                                                        {dept.review_health?.next_scheduled ? format(new Date(dept.review_health.next_scheduled), 'dd/MM/yy') : '--'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sub-row for health / targets if needed to match sketch (Health parallel to Reviews done) */}
                                        <div className="bg-slate-50/50 dark:bg-dark-card/30 flex w-full border-t border-slate-200 dark:border-white/10 text-sm divide-x divide-slate-200 dark:divide-white/10">
                                            <div className="font-black text-slate-700 dark:text-slate-300 py-3 px-4 w-32 shrink-0 flex items-center text-xs uppercase tracking-wider bg-white dark:bg-white/5">
                                                Health
                                            </div>
                                            <div className="flex-1 flex items-center px-4 py-3">
                                                <div className="w-full max-w-sm flex items-center gap-3">
                                                    <HealthBar score={dept.review_health?.score || 0} />
                                                    <ReviewDebtBadge status={dept.review_health?.status} />
                                                </div>
                                            </div>
                                        </div>

                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Right Panel: Recent Reviews + Summary */}
                <div className="space-y-6">
                    {/* Summary Chips */}
                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={18} className="text-indigo-600" />
                            <h3 className="font-black text-slate-800 dark:text-white">Quick Stats</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Departments</span>
                                <span className="font-bold text-slate-800 dark:text-white">{departments.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Critical</span>
                                <span className="font-bold text-rose-600">{criticalDepts.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Needs Attention</span>
                                <span className="font-bold text-amber-600">{warningDepts.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">On Track</span>
                                <span className="font-bold text-emerald-600">{healthyDepts.length}</span>
                            </div>
                            <div className="border-t border-slate-100 dark:border-white/10 pt-3 mt-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500">Task Completion</span>
                                    <span className="font-bold text-indigo-600">
                                        {taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Reviews */}
                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <CalendarCheck size={18} className="text-indigo-600" />
                                <h3 className="font-black text-slate-800 dark:text-white">Recent Reviews</h3>
                            </div>
                        </div>
                        {recentSessions.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">No reviews scheduled yet</p>
                        ) : (
                            <div className="space-y-2">
                                {recentSessions.map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => navigate(`/reviews/${session.id}`)}
                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                                    >
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${session.status === 'Completed' ? 'bg-emerald-500' :
                                                session.status === 'Scheduled' ? 'bg-indigo-500' :
                                                    session.status === 'Missed' ? 'bg-rose-500' : 'bg-slate-300'
                                            }`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-white truncate">
                                                {session.program_name}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">{session.department_name}</p>
                                        </div>
                                        <span className="text-xs text-slate-400 shrink-0">
                                            {format(new Date(session.scheduled_date), 'd MMM')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap size={18} className="text-indigo-600" />
                            <h3 className="font-black text-slate-800 dark:text-white">Quick Actions</h3>
                        </div>
                        <div className="space-y-2">
                            <button
                                onClick={() => navigate('/departments')}
                                className="w-full text-left px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold text-sm hover:bg-indigo-100 transition-colors flex items-center justify-between group"
                            >
                                Manage Departments
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => navigate('/tasks')}
                                className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 transition-colors flex items-center justify-between group"
                            >
                                View All Tasks
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => navigate('/planner')}
                                className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 transition-colors flex items-center justify-between group"
                            >
                                Weekly Planner
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Overview;
