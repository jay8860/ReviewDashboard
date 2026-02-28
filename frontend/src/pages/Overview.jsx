import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Building2, ClipboardList, AlertTriangle, CheckCircle2,
    Clock, ArrowRight, RefreshCw,
    Activity, Zap, Calendar, ChevronRight
} from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { api } from '../services/api';
import { format } from 'date-fns';

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

const meetingStatusDot = {
    Done: 'bg-emerald-500',
    Scheduled: 'bg-indigo-500',
    Cancelled: 'bg-slate-300',
};

const meetingStatusText = {
    Done: 'text-emerald-500',
    Scheduled: 'text-indigo-500',
    Cancelled: 'text-slate-400',
};

const Overview = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0 });
    const [deptMeetings, setDeptMeetings] = useState({});
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [depts, stats] = await Promise.all([
                api.getDepartments(),
                api.getTaskStats(),
            ]);
            setDepartments(depts);
            setTaskStats(stats);

            const meetingResults = await Promise.allSettled(
                depts.map(d => api.getMeetings(d.id).then(meetings => ({ deptId: d.id, meetings })))
            );
            const meetingsMap = {};
            meetingResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    meetingsMap[result.value.deptId] = result.value.meetings;
                }
            });
            setDeptMeetings(meetingsMap);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const allMeetings = useMemo(() => {
        const byDeptId = Object.fromEntries(departments.map(d => [d.id, d]));
        return Object.entries(deptMeetings).flatMap(([deptId, meetings]) => {
            const dept = byDeptId[Number(deptId)];
            return (meetings || []).map(m => ({
                ...m,
                department_id: Number(deptId),
                department_name: dept?.name || 'Department',
                department_color: dept?.color || 'indigo',
            }));
        });
    }, [deptMeetings, departments]);

    const now = new Date();
    const upcomingMeetings = [...allMeetings]
        .filter(m => m.status === 'Scheduled' && new Date(m.scheduled_date) >= now)
        .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
        .slice(0, 6);

    const recentMeetings = [...allMeetings]
        .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date))
        .slice(0, 8);

    const scheduledCount = allMeetings.filter(m => m.status === 'Scheduled').length;
    const doneCount = allMeetings.filter(m => m.status === 'Done').length;
    const cancelledCount = allMeetings.filter(m => m.status === 'Cancelled').length;

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tight">
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <StatCard title="Total Tasks" value={taskStats.total} icon={ClipboardList} color="indigo" delay={0} onClick={() => navigate('/tasks')} />
                <StatCard title="Completed" value={taskStats.completed} icon={CheckCircle2} color="green" delay={1} onClick={() => navigate('/tasks?status=Completed')} />
                <StatCard title="Pending" value={taskStats.pending} icon={Clock} color="yellow" delay={2} onClick={() => navigate('/tasks?status=Pending')} />
                <StatCard title="Overdue" value={taskStats.overdue} icon={AlertTriangle} color="red" delay={3} onClick={() => navigate('/tasks?status=Overdue')} />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-black dark:text-white">Department Meetings</h2>
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
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {departments.map((dept, i) => {
                                const deptMeetingList = deptMeetings[dept.id] || [];
                                const upcoming = deptMeetingList
                                    .filter(m => m.status === 'Scheduled' && new Date(m.scheduled_date) >= now)
                                    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
                                const recent = [...deptMeetingList]
                                    .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));

                                return (
                                    <motion.div
                                        key={dept.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="glass-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                                    >
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
                                                    <h3 className="font-black text-slate-800 dark:text-white">{dept.name}</h3>
                                                    {dept.head_name && <p className="text-xs text-slate-400">{dept.head_name}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 rounded-full">
                                                    <Calendar size={10} /> {deptMeetingList.length} mtg{deptMeetingList.length > 1 ? 's' : ''}
                                                </span>
                                                <ChevronRight size={16} className="text-slate-300 dark:text-white/20" />
                                            </div>
                                        </div>

                                        <div className="flex w-full border-b border-slate-100 dark:border-white/5 text-sm divide-x divide-slate-100 dark:divide-white/5">
                                            <div className="font-black text-slate-500 dark:text-slate-400 py-2.5 px-4 w-32 shrink-0 flex items-center text-[10px] uppercase tracking-wider bg-white/60 dark:bg-white/3">
                                                Meetings
                                            </div>
                                            <div className="flex-1 flex overflow-x-auto">
                                                {recent.slice(0, 4).map((m) => (
                                                    <div
                                                        key={m.id}
                                                        className="px-3 py-2.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 cursor-pointer border-r border-slate-100 dark:border-white/5 shrink-0 flex flex-col items-center justify-center min-w-[88px] transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/departments/${dept.id}`); }}
                                                    >
                                                        <span className="text-xs font-bold">{format(new Date(m.scheduled_date), 'dd/MM/yy')}</span>
                                                        <span className={`text-[9px] mt-0.5 font-bold uppercase tracking-wide ${meetingStatusText[m.status] || 'text-slate-400'}`}>
                                                            {m.status}
                                                        </span>
                                                    </div>
                                                ))}
                                                {deptMeetingList.length === 0 && (
                                                    <div className="px-4 py-2.5 text-xs text-slate-300 dark:text-white/20 italic flex items-center">
                                                        No meetings yet
                                                    </div>
                                                )}
                                                <div className="flex-1" />
                                            </div>
                                            <div className="py-2 px-3 shrink-0 flex items-center justify-center bg-white/60 dark:bg-white/3 min-w-[90px]">
                                                <div className="text-center">
                                                    <p className="text-[9px] font-black uppercase text-violet-500 tracking-wider">Next</p>
                                                    <p className="font-bold text-slate-700 dark:text-white text-xs mt-0.5">
                                                        {upcoming[0]
                                                            ? format(new Date(upcoming[0].scheduled_date), 'dd/MM/yy')
                                                            : '—'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="space-y-5">
                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={16} className="text-indigo-600" />
                            <h3 className="font-black text-slate-800 dark:text-white text-sm">Quick Stats</h3>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: 'Departments', value: departments.length, color: 'text-slate-700 dark:text-white' },
                                { label: 'Meetings Total', value: allMeetings.length, color: 'text-indigo-600' },
                                { label: 'Scheduled', value: scheduledCount, color: 'text-indigo-600' },
                                { label: 'Done', value: doneCount, color: 'text-emerald-600' },
                                { label: 'Cancelled', value: cancelledCount, color: 'text-slate-500' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500">{label}</span>
                                    <span className={`font-black text-lg ${color}`}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {upcomingMeetings.length > 0 && (
                        <div className="glass-card rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar size={16} className="text-indigo-600" />
                                <h3 className="font-black text-slate-800 dark:text-white text-sm">Upcoming Meetings</h3>
                            </div>
                            <div className="space-y-2">
                                {upcomingMeetings.map(m => (
                                    <div
                                        key={`${m.department_id}-${m.id}`}
                                        onClick={() => navigate(`/departments/${m.department_id}`)}
                                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 cursor-pointer transition-colors group"
                                    >
                                        <div className={`w-2 h-2 rounded-full ${meetingStatusDot[m.status] || 'bg-slate-300'} shrink-0`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-white truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                                                {m.department_name}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">{m.venue || 'No venue set'}</p>
                                        </div>
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                            {format(new Date(m.scheduled_date), 'd MMM')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-indigo-600" />
                                <h3 className="font-black text-slate-800 dark:text-white text-sm">Recent Meetings</h3>
                            </div>
                            <span className="text-xs text-slate-400 font-semibold">{allMeetings.length} total</span>
                        </div>
                        {recentMeetings.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4 italic">No meetings scheduled yet</p>
                        ) : (
                            <div className="space-y-1.5">
                                {recentMeetings.map(m => (
                                    <div
                                        key={`recent-${m.department_id}-${m.id}`}
                                        onClick={() => navigate(`/departments/${m.department_id}`)}
                                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                                    >
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${meetingStatusDot[m.status] || 'bg-slate-300'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                {m.department_name}
                                            </p>
                                            <p className="text-[10px] text-slate-400 truncate">{m.venue || 'No venue'}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] text-slate-400">
                                                {format(new Date(m.scheduled_date), 'd MMM')}
                                            </p>
                                            <p className={`text-[9px] font-bold uppercase tracking-wide ${meetingStatusText[m.status] || 'text-slate-400'}`}>
                                                {m.status}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

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
