import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Building2, ClipboardList, AlertTriangle, CheckCircle2,
    Clock, ArrowRight, RefreshCw, FileDown,
    Activity, Zap, Calendar, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { addDays, endOfDay, format, isSameDay, parseISO, startOfDay } from 'date-fns';

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

const meetingStatusText = {
    Done: 'text-emerald-500',
    Scheduled: 'text-indigo-500',
    Cancelled: 'text-slate-400',
};

const timelineTypeStyles = {
    task: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    review: 'bg-violet-50 text-violet-700 border-violet-200',
    visit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const timelineTypeLabel = {
    task: 'Task',
    review: 'Review',
    visit: 'Visit',
};

const toSafeDate = (value) => {
    if (!value) return null;
    try {
        const parsed = parseISO(String(value));
        if (!Number.isNaN(parsed.getTime())) return parsed;
    } catch {
        // ignore parse errors
    }
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const formatTimeLabel = (value) => {
    if (!value) return 'All day';
    const text = String(value).trim();
    const parts = text.split(':');
    if (parts.length < 2) return text;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return text;
    const dt = new Date();
    dt.setHours(hours, minutes, 0, 0);
    return format(dt, 'h:mm a');
};

const Overview = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const toast = useToast();
    const [departments, setDepartments] = useState([]);
    const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0 });
    const [deptMeetings, setDeptMeetings] = useState({});
    const [taskRows, setTaskRows] = useState([]);
    const [reviewRows, setReviewRows] = useState([]);
    const [plannerRows, setPlannerRows] = useState([]);
    const [fieldVisitDraftRows, setFieldVisitDraftRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deptSectionCollapsed, setDeptSectionCollapsed] = useState(false);
    const [timelineFilters, setTimelineFilters] = useState({
        tasks: true,
        reviews: true,
        visits: true,
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const startDate = format(new Date(), 'yyyy-MM-dd');
            const endDate = format(addDays(new Date(), 45), 'yyyy-MM-dd');
            const [deptsRes, statsRes, tasksRes, reviewsRes, plannerRes, fieldDraftsRes] = await Promise.allSettled([
                api.getDepartments(),
                api.getTaskStats(),
                api.getTasks({ status: 'Pending,In Progress,Overdue' }),
                api.getSessions(),
                api.getPlannerEvents(startDate, endDate),
                api.getFieldVisitDrafts(),
            ]);

            const depts = deptsRes.status === 'fulfilled' ? (deptsRes.value || []) : [];
            const stats = statsRes.status === 'fulfilled' ? (statsRes.value || { total: 0, completed: 0, pending: 0, overdue: 0 }) : { total: 0, completed: 0, pending: 0, overdue: 0 };
            const tasks = tasksRes.status === 'fulfilled' ? (tasksRes.value || []) : [];
            const reviews = reviewsRes.status === 'fulfilled' ? (reviewsRes.value || []) : [];
            const plannerEvents = plannerRes.status === 'fulfilled' ? (plannerRes.value || []) : [];
            const fieldDrafts = fieldDraftsRes.status === 'fulfilled' ? (fieldDraftsRes.value || []) : [];

            setDepartments(depts);
            setTaskStats(stats);
            setTaskRows(tasks);
            setReviewRows(reviews);
            setPlannerRows(plannerEvents);
            setFieldVisitDraftRows(fieldDrafts);

            if (depts.length) {
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
            } else {
                setDeptMeetings({});
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadBackup = async () => {
        try {
            const response = await api.downloadBackup();
            const blob = new Blob([response.data], { type: 'application/json' });
            const fileName = `reviewdashboard_backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;
            const href = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = href;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(href);
            toast.success('Backup file downloaded');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to download backup');
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
    const scheduledCount = allMeetings.filter(m => m.status === 'Scheduled').length;
    const doneCount = allMeetings.filter(m => m.status === 'Done').length;
    const cancelledCount = allMeetings.filter(m => m.status === 'Cancelled').length;

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const unifiedScheduleItems = useMemo(() => {
        const items = [];
        const weekStart = startOfDay(today);

        (taskRows || []).forEach(task => {
            if (!task.is_today) return;
            let due = toSafeDate(task.deadline_date || task.allocated_date);
            if (!due || task.is_today) due = new Date(today);
            if (due < weekStart) return;
            items.push({
                id: `task-${task.id}`,
                type: 'task',
                date: due,
                time_slot: null,
                title: task.description || task.task_number || 'Task',
                subtitle: task.assigned_agency || task.department_name || 'Task follow-up',
                status: task.status || 'Pending',
                route: '/tasks',
            });
        });

        (allMeetings || []).forEach(review => {
            const scheduled = toSafeDate(review.scheduled_date);
            if (!scheduled || scheduled < weekStart) return;
            if ((review.status || '').toLowerCase() === 'cancelled') return;
            items.push({
                id: `review-${review.id}`,
                type: 'review',
                date: scheduled,
                time_slot: review.time_slot,
                title: review.program_name || review.department_name || 'Department Review',
                subtitle: review.department_name || 'Department',
                status: review.status || 'Scheduled',
                route: review.department_id ? `/departments/${review.department_id}` : '/departments',
            });
        });

        (plannerRows || []).forEach(event => {
            const planned = toSafeDate(event.date);
            if (!planned || planned < weekStart) return;
            if ((event.event_type || '').toLowerCase() !== 'field-visit') return;
            if ((event.status || '').toLowerCase() === 'cancelled') return;
            items.push({
                id: `visit-planner-${event.id}`,
                type: 'visit',
                date: planned,
                time_slot: event.time_slot,
                title: event.title || 'Field Visit',
                subtitle: event.department_name || event.venue || 'Field visit',
                status: event.status || 'Planned',
                route: '/field-visits',
            });
        });

        if (!items.some(item => item.type === 'visit')) {
            (fieldVisitDraftRows || []).forEach(draft => {
                const planned = toSafeDate(draft.planned_date);
                if (!planned || planned < weekStart) return;
                if (!['planned', 'draft'].includes((draft.status || '').toLowerCase())) return;
                items.push({
                    id: `visit-draft-${draft.id}`,
                    type: 'visit',
                    date: planned,
                    time_slot: draft.planned_time,
                    title: draft.title || 'Field Visit',
                    subtitle: draft.department_name || draft.location || 'Field visit draft',
                    status: draft.status || 'Planned',
                    route: '/field-visits',
                });
            });
        }

        const toTimeRank = (timeSlot) => {
            if (!timeSlot) return 24 * 60;
            const text = String(timeSlot).trim();
            const parts = text.split(':');
            if (parts.length < 2) return 24 * 60;
            const hours = Number(parts[0]);
            const minutes = Number(parts[1]);
            if (Number.isNaN(hours) || Number.isNaN(minutes)) return 24 * 60;
            return (hours * 60) + minutes;
        };

        return items.sort((a, b) => {
            const dateDiff = a.date - b.date;
            if (dateDiff !== 0) return dateDiff;
            const timeDiff = toTimeRank(a.time_slot) - toTimeRank(b.time_slot);
            if (timeDiff !== 0) return timeDiff;
            return a.title.localeCompare(b.title);
        });
    }, [taskRows, allMeetings, plannerRows, fieldVisitDraftRows, today]);

    const filteredUnifiedItems = useMemo(() => {
        return unifiedScheduleItems.filter(item => {
            if (item.type === 'task') return timelineFilters.tasks;
            if (item.type === 'review') return timelineFilters.reviews;
            if (item.type === 'visit') return timelineFilters.visits;
            return true;
        });
    }, [unifiedScheduleItems, timelineFilters]);

    const thisWeekTimelineItems = useMemo(() => {
        const weekEnd = endOfDay(addDays(today, 6));
        return filteredUnifiedItems.filter(item => item.date <= weekEnd).slice(0, 20);
    }, [filteredUnifiedItems, today]);

    const tomorrow = useMemo(() => addDays(today, 1), [today]);

    const scheduledTodayItems = useMemo(() => {
        return filteredUnifiedItems.filter(item => isSameDay(item.date, today)).slice(0, 8);
    }, [filteredUnifiedItems, today]);

    const scheduledTomorrowItems = useMemo(() => {
        return filteredUnifiedItems.filter(item => isSameDay(item.date, tomorrow)).slice(0, 8);
    }, [filteredUnifiedItems, tomorrow]);

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
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadBackup}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-sm font-semibold"
                        title="Download full backup JSON"
                    >
                        <FileDown size={16} />
                        Backup
                    </button>
                    <button
                        onClick={loadData}
                        className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
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
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setDeptSectionCollapsed(prev => !prev)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1"
                            >
                                {deptSectionCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                {deptSectionCollapsed ? 'Expand' : 'Collapse'}
                            </button>
                            <button
                                onClick={() => navigate('/departments')}
                                className="text-sm font-semibold text-indigo-600 flex items-center gap-1 hover:underline"
                            >
                                All Departments <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>

                    {deptSectionCollapsed ? (
                        <div className="glass-card rounded-2xl p-5">
                            <p className="text-sm text-slate-500">
                                Department section collapsed. Expand to view all departments with recent meetings.
                            </p>
                        </div>
                    ) : loading ? (
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

                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-indigo-600" />
                                <h3 className="font-black text-slate-800 dark:text-white text-sm">This Week Timeline</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-500">{format(today, 'd MMM')} - {format(addDays(today, 6), 'd MMM')}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <button
                                type="button"
                                onClick={() => setTimelineFilters(prev => ({ ...prev, tasks: !prev.tasks }))}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors ${timelineFilters.tasks ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}
                            >
                                Tasks (Today)
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimelineFilters(prev => ({ ...prev, reviews: !prev.reviews }))}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors ${timelineFilters.reviews ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-white text-slate-500 border-slate-200'}`}
                            >
                                Reviews
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimelineFilters(prev => ({ ...prev, visits: !prev.visits }))}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors ${timelineFilters.visits ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}
                            >
                                Field Visits
                            </button>
                        </div>

                        {thisWeekTimelineItems.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-2 italic">No tasks, reviews, or field visits scheduled this week</p>
                        ) : (
                            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                {thisWeekTimelineItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => navigate(item.route)}
                                        className="min-w-[176px] text-left rounded-xl border border-slate-200 bg-white/80 p-3 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${timelineTypeStyles[item.type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                {timelineTypeLabel[item.type] || 'Item'}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500">
                                                {format(item.date, 'EEE, d MMM')}
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                                        <p className="text-[11px] text-slate-500 truncate mt-1">{item.subtitle}</p>
                                        <p className="text-[10px] font-semibold text-indigo-600 mt-2">{formatTimeLabel(item.time_slot)}</p>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-700 mb-2">Scheduled Today</h4>
                                {scheduledTodayItems.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Nothing scheduled today</p>
                                ) : (
                                    <div className="space-y-2">
                                        {scheduledTodayItems.map(item => (
                                            <button
                                                key={`today-${item.id}`}
                                                onClick={() => navigate(item.route)}
                                                className="w-full text-left rounded-lg bg-white/85 border border-indigo-100 px-2.5 py-2 hover:bg-white transition-colors"
                                            >
                                                <p className="text-[11px] font-bold text-slate-800 truncate">{item.title}</p>
                                                <p className="text-[10px] text-slate-500 truncate">{timelineTypeLabel[item.type]} · {formatTimeLabel(item.time_slot)}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-violet-700 mb-2">Scheduled Tomorrow</h4>
                                {scheduledTomorrowItems.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Nothing scheduled tomorrow</p>
                                ) : (
                                    <div className="space-y-2">
                                        {scheduledTomorrowItems.map(item => (
                                            <button
                                                key={`tomorrow-${item.id}`}
                                                onClick={() => navigate(item.route)}
                                                className="w-full text-left rounded-lg bg-white/85 border border-violet-100 px-2.5 py-2 hover:bg-white transition-colors"
                                            >
                                                <p className="text-[11px] font-bold text-slate-800 truncate">{item.title}</p>
                                                <p className="text-[10px] text-slate-500 truncate">{timelineTypeLabel[item.type]} · {formatTimeLabel(item.time_slot)}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
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
