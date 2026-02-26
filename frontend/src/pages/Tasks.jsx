import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ClipboardList, Plus, Trash2, Edit2, X, Search, Filter,
    CheckCircle2, Clock, AlertTriangle, RefreshCw, FileDown, ChevronDown
} from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { api } from '../services/api';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Overdue'];
const PRIORITY_OPTIONS = ['Low', 'Normal', 'High', 'Critical'];

const statusColor = {
    Pending: 'bg-amber-100 text-amber-700',
    'In Progress': 'bg-indigo-100 text-indigo-700',
    Completed: 'bg-emerald-100 text-emerald-700',
    Overdue: 'bg-rose-100 text-rose-700',
};

const priorityBadge = {
    Critical: 'bg-rose-100 text-rose-700',
    High: 'bg-orange-100 text-orange-700',
    Normal: 'bg-slate-100 text-slate-500',
    Low: 'bg-slate-50 text-slate-400',
};

// ── Task Modal ─────────────────────────────────────────────────────────────────
const TaskModal = ({ isOpen, onClose, onSave, departments = [], initial = null }) => {
    const [form, setForm] = useState({
        task_number: '', description: '', assigned_agency: '',
        deadline_date: '', status: 'Pending', priority: 'Normal',
        remarks: '', department_id: ''
    });

    useEffect(() => {
        if (initial) setForm({
            task_number: initial.task_number || '',
            description: initial.description || '',
            assigned_agency: initial.assigned_agency || '',
            deadline_date: initial.deadline_date || '',
            status: initial.status || 'Pending',
            priority: initial.priority || 'Normal',
            remarks: initial.remarks || '',
            department_id: initial.department_id || ''
        });
        else setForm({ task_number: '', description: '', assigned_agency: '', deadline_date: '', status: 'Pending', priority: 'Normal', remarks: '', department_id: '' });
    }, [initial, isOpen]);

    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-lg shadow-premium-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">{initial ? 'Edit' : 'New'} Task</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={20} className="text-slate-400" /></button>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Task Number</label>
                                <input value={form.task_number} onChange={e => setForm({ ...form, task_number: e.target.value })}
                                    placeholder="Auto-generated if blank"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Department</label>
                                <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm">
                                    <option value="">None</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Description</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={3} placeholder="Task description..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Assigned Agency / Officer</label>
                            <input value={form.assigned_agency} onChange={e => setForm({ ...form, assigned_agency: e.target.value })}
                                placeholder="e.g. District Education Officer"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Deadline</label>
                                <input type="date" value={form.deadline_date} onChange={e => setForm({ ...form, deadline_date: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Priority</label>
                                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm">
                                    {PRIORITY_OPTIONS.map(p => <option key={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                        {initial && (
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Status</label>
                                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm">
                                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Remarks</label>
                            <input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}
                                placeholder="Optional remarks"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                            <button type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20">
                                {initial ? 'Save' : 'Create'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const Tasks = ({ user, onLogout }) => {
    const [searchParams] = useSearchParams();
    const [tasks, setTasks] = useState([]);
    const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0 });
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
    const [filterDept, setFilterDept] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editTask, setEditTask] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [t, s, d] = await Promise.all([
                api.getTasks({ status: filterStatus, search, department_id: filterDept }),
                api.getTaskStats(),
                api.getDepartments()
            ]);
            setTasks(t);
            setStats(s);
            setDepartments(d);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [filterStatus, filterDept]);

    const handleSearch = (e) => {
        if (e.key === 'Enter') load();
    };

    const handleSave = async (form) => {
        try {
            const payload = { ...form };
            if (payload.department_id === '') payload.department_id = null;
            else if (payload.department_id) payload.department_id = parseInt(payload.department_id);
            if (editTask) await api.updateTask(editTask.id, payload);
            else await api.createTask(payload);
            setModalOpen(false);
            setEditTask(null);
            load();
        } catch { alert('Error saving task'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this task?')) return;
        await api.deleteTask(id);
        load();
    };

    const handleQuickStatus = async (id, status) => {
        await api.updateTask(id, { status });
        load();
    };

    const exportExcel = () => {
        const rows = tasks.map(t => ({
            'Task #': t.task_number,
            'Description': t.description,
            'Agency': t.assigned_agency,
            'Deadline': t.deadline_date,
            'Status': t.status,
            'Priority': t.priority,
            'Remarks': t.remarks
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
        XLSX.writeFile(wb, `tasks_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tight">Tasks</h1>
                    <p className="text-slate-500 dark:text-dark-muted mt-1">Track all tasks across departments</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <FileDown size={16} /> Export
                    </button>
                    {user?.role === 'admin' && (
                        <button onClick={() => { setEditTask(null); setModalOpen(true); }}
                            className="flex items-center gap-2 px-5 py-3 bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 transition-colors">
                            <Plus size={18} /> New Task
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <StatCard title="Total" value={stats.total} icon={ClipboardList} color="indigo" delay={0} onClick={() => setFilterStatus('')} />
                <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} color="green" delay={1} onClick={() => setFilterStatus('Completed')} />
                <StatCard title="Pending" value={stats.pending} icon={Clock} color="yellow" delay={2} onClick={() => setFilterStatus('Pending')} />
                <StatCard title="Overdue" value={stats.overdue} icon={AlertTriangle} color="red" delay={3} onClick={() => setFilterStatus('Overdue')} />
            </div>

            {/* Filters */}
            <div className="glass-card rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-48">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearch}
                        placeholder="Search tasks... (press Enter)"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all">
                    <option value="">All Status</option>
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all">
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button onClick={load} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Task Table */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => <div key={i} className="glass-card rounded-2xl h-16 animate-pulse" />)}
                </div>
            ) : tasks.length === 0 ? (
                <div className="glass-card rounded-3xl p-16 text-center">
                    <ClipboardList size={48} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-lg font-black text-slate-400">No tasks found</p>
                </div>
            ) : (
                <div className="glass-card rounded-3xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/10">
                                    <th className="text-left px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Task</th>
                                    <th className="text-left px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Agency</th>
                                    <th className="text-left px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Dept</th>
                                    <th className="text-left px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Deadline</th>
                                    <th className="text-left px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                                    <th className="text-left px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Priority</th>
                                    {user?.role === 'admin' && <th className="px-4 py-4" />}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                                {tasks.map((task, i) => (
                                    <motion.tr key={task.id}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                                        className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-sm text-indigo-700 dark:text-indigo-300">{task.task_number}</p>
                                            {task.description && (
                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 max-w-64">{task.description}</p>
                                            )}
                                            {task.source === 'action_point' && (
                                                <span className="text-xs text-violet-600 font-semibold">from review</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-sm text-slate-600 dark:text-slate-300">{task.assigned_agency || '—'}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-xs text-slate-400">{task.department_id ? deptMap[task.department_id] || '—' : '—'}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-sm ${task.status === 'Overdue' ? 'text-rose-500 font-semibold' : 'text-slate-500'}`}>
                                                {task.deadline_date ? format(parseISO(task.deadline_date), 'd MMM yy') : '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {user?.role === 'admin' ? (
                                                <select value={task.status}
                                                    onChange={e => handleQuickStatus(task.id, e.target.value)}
                                                    className={`text-xs font-bold px-2 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${statusColor[task.status]}`}>
                                                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                                                </select>
                                            ) : (
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor[task.status]}`}>{task.status}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${priorityBadge[task.priority]}`}>{task.priority}</span>
                                        </td>
                                        {user?.role === 'admin' && (
                                            <td className="px-4 py-4">
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditTask(task); setModalOpen(true); }}
                                                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(task.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <TaskModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditTask(null); }}
                onSave={handleSave} departments={departments} initial={editTask} />
        </Layout>
    );
};

export default Tasks;
