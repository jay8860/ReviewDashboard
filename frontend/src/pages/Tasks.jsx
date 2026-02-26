import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
    ClipboardList, Plus, X, Search, RefreshCw, FileDown,
    CheckCircle2, Clock, AlertTriangle, Flame, Pin, List,
    ChevronDown, Trash2, Edit2, CheckSquare
} from 'lucide-react';
import Layout from '../components/Layout';

const StatPill = ({ icon: Icon, label, value, color }) => {
    const colorStyles = {
        indigo: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400',
        emerald: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
        amber: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400',
        rose: 'text-rose-700 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400',
        orange: 'text-orange-700 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400'
    };
    return (
        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 px-6 py-4 rounded-full shadow-sm border border-slate-100 dark:border-white/5 flex-1 min-w-[200px]">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${colorStyles[color] || colorStyles.indigo}`}>
                <Icon size={24} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
                <span className="text-3xl font-black text-slate-800 dark:text-white leading-none tracking-tight">{value}</span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">{label}</span>
            </div>
        </div>
    );
};
import TaskTable from '../components/TaskTable';
import { api } from '../services/api';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Overdue'];
const PRIORITY_OPTIONS = ['Low', 'Normal', 'High', 'Critical'];

// ── Add / Edit Task Modal — minimal with expandable advanced ───────────────────
const TaskModal = ({ isOpen, onClose, onSave, departments = [], employees = [], initial = null }) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const blank = {
        description: '', assigned_agency: '', days_given: '7', deadline_date: '',
        // auto-filled / advanced
        task_number: '', allocated_date: todayStr, time_given: '7 days',
        completion_date: '', steno_comment: '', status: 'Pending', priority: 'Normal',
        remarks: '', department_id: '', assigned_employee_id: '', is_pinned: false, is_today: false,
    };
    const [form, setForm] = useState(blank);
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        if (initial) {
            setForm({
                task_number: initial.task_number || '',
                description: initial.description || '',
                assigned_agency: initial.assigned_agency || '',
                days_given: initial.time_given ? initial.time_given.replace(/\D/g, '') : '7',
                deadline_date: initial.deadline_date || '',
                allocated_date: initial.allocated_date || todayStr,
                time_given: initial.time_given || '7 days',
                completion_date: initial.completion_date || '',
                steno_comment: initial.steno_comment || '',
                status: initial.status || 'Pending',
                priority: initial.priority || 'Normal',
                remarks: initial.remarks || '',
                department_id: initial.department_id || '',
                assigned_employee_id: initial.assigned_employee_id || '',
                is_pinned: initial.is_pinned || false,
                is_today: initial.is_today || false,
            });
            setShowAdvanced(false);
        } else {
            setForm(blank);
            setShowAdvanced(false);
        }
    }, [initial, isOpen]);

    if (!isOpen) return null;

    const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
    const fc = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.checked }));

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = { ...form };
        // Auto-set time_given from days_given
        if (form.days_given && !initial) payload.time_given = `${form.days_given} days`;
        // Auto-set deadline if days given but no deadline
        if (form.days_given && !form.deadline_date && !initial) {
            const dl = new Date();
            dl.setDate(dl.getDate() + parseInt(form.days_given || 7));
            payload.deadline_date = dl.toISOString().split('T')[0];
        }
        // Always set allocated_date to today for new tasks
        if (!initial) payload.allocated_date = todayStr;
        onSave(payload);
    };

    const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5";

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-lg shadow-premium-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">{initial ? 'Edit' : 'New'} Task</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={20} className="text-slate-400" /></button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* ── CORE FIELDS (always visible) ── */}

                        {/* Task Description */}
                        <div>
                            <label className={labelCls}>Task / Work *</label>
                            <textarea required autoFocus value={form.description} onChange={f('description')} rows={2}
                                placeholder="What needs to be done?"
                                className={inputCls + " resize-none"} />
                        </div>

                        {/* Assigned to */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Assigned Employee</label>
                                <select value={form.assigned_employee_id} onChange={f('assigned_employee_id')} className={inputCls}>
                                    <option value="">None</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.display_username})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Other Agency</label>
                                <input value={form.assigned_agency} onChange={f('assigned_agency')}
                                    placeholder="Ex: PWD, CREDA" className={inputCls} />
                            </div>
                        </div>

                        {/* Days Given + Deadline side by side */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Days Given</label>
                                <input type="number" min={1} value={form.days_given} onChange={f('days_given')}
                                    placeholder="7" className={inputCls} />
                                <p className="text-[10px] text-slate-400 mt-1">Default: 7 days</p>
                            </div>
                            <div>
                                <label className={labelCls}>Deadline Date</label>
                                <input type="date" value={form.deadline_date} onChange={f('deadline_date')} className={inputCls} />
                                <p className="text-[10px] text-slate-400 mt-1">Auto-set if blank</p>
                            </div>
                        </div>

                        {/* Status (edit only, core) */}
                        {initial && (
                            <div>
                                <label className={labelCls}>Status</label>
                                <select value={form.status} onChange={f('status')} className={inputCls}>
                                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                        )}

                        {/* ── MORE OPTIONS ── */}
                        <button type="button" onClick={() => setShowAdvanced(s => !s)}
                            className="flex items-center gap-2 text-xs text-indigo-600 font-bold hover:text-indigo-700 transition-colors py-1">
                            <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                            {showAdvanced ? 'Hide' : 'More'} options
                        </button>

                        <AnimatePresence>
                            {showAdvanced && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden space-y-4">

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelCls}>Priority</label>
                                            <select value={form.priority} onChange={f('priority')} className={inputCls}>
                                                {PRIORITY_OPTIONS.map(p => <option key={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Department</label>
                                            <select value={form.department_id} onChange={f('department_id')} className={inputCls}>
                                                <option value="">None</option>
                                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelCls}>Steno / Follow-up Note</label>
                                        <textarea value={form.steno_comment} onChange={f('steno_comment')} rows={2}
                                            placeholder="Notes for secretary/steno..."
                                            className={inputCls + " resize-none"} />
                                    </div>

                                    <div>
                                        <label className={labelCls}>Remarks</label>
                                        <input value={form.remarks} onChange={f('remarks')} placeholder="Any additional remarks" className={inputCls} />
                                    </div>

                                    {initial && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls}>Completion Date</label>
                                                <input type="date" value={form.completion_date} onChange={f('completion_date')} className={inputCls} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Task #</label>
                                                <input value={form.task_number} onChange={f('task_number')} className={inputCls} />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-5">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={form.is_pinned} onChange={fc('is_pinned')} className="w-4 h-4 rounded text-indigo-600" />
                                            <span className="text-sm text-slate-600 dark:text-slate-300 font-semibold">📌 Pin</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={form.is_today} onChange={fc('is_today')} className="w-4 h-4 rounded text-indigo-600" />
                                            <span className="text-sm text-slate-600 dark:text-slate-300 font-semibold">📅 Today</span>
                                        </label>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20">
                                {initial ? 'Save' : 'Create Task'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Bulk Edit Panel ────────────────────────────────────────────────────────────
const BulkEditPanel = ({ count, onStatusChange, onPriorityChange, onDelete, onClear }) => {
    const [showStatus, setShowStatus] = useState(false);
    const [showPriority, setShowPriority] = useState(false);

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl px-5 py-3 flex items-center gap-4 mb-4 border-2 border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-900/10">
            <div className="flex items-center gap-2">
                <CheckSquare size={16} className="text-indigo-600" />
                <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">{count} selected</span>
            </div>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
                {/* Bulk Status */}
                <div className="relative">
                    <button onClick={() => { setShowStatus(s => !s); setShowPriority(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:border-indigo-300 transition-colors">
                        Set Status <ChevronDown size={12} />
                    </button>
                    <AnimatePresence>
                        {showStatus && (
                            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-20 py-1 min-w-36">
                                {STATUS_OPTIONS.map(s => (
                                    <button key={s} onClick={() => { onStatusChange(s); setShowStatus(false); }}
                                        className="w-full text-left px-4 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300 font-semibold transition-colors">
                                        {s}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bulk Priority */}
                <div className="relative">
                    <button onClick={() => { setShowPriority(s => !s); setShowStatus(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:border-indigo-300 transition-colors">
                        Set Priority <ChevronDown size={12} />
                    </button>
                    <AnimatePresence>
                        {showPriority && (
                            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-20 py-1 min-w-36">
                                {PRIORITY_OPTIONS.map(p => (
                                    <button key={p} onClick={() => { onPriorityChange(p); setShowPriority(false); }}
                                        className="w-full text-left px-4 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300 font-semibold transition-colors">
                                        {p}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bulk Mark Complete */}
                <button onClick={() => onStatusChange('Completed')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                    <CheckCircle2 size={12} /> Mark Complete
                </button>

                {/* Bulk Delete */}
                <button onClick={onDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors">
                    <Trash2 size={12} /> Delete
                </button>
            </div>

            <button onClick={onClear} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <X size={14} />
            </button>
        </motion.div>
    );
};

// ── Tab Button ─────────────────────────────────────────────────────────────────
const Tab = ({ label, icon: Icon, active, onClick, count }) => (
    <button onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${active
            ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}>
        <Icon size={15} />
        {label}
        {count !== undefined && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}`}>{count}</span>
        )}
    </button>
);

// ── Main Page ──────────────────────────────────────────────────────────────────
const Tasks = ({ user, onLogout }) => {
    const [searchParams] = useSearchParams();
    const [tasks, setTasks] = useState([]);
    const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0, important: 0 });
    const [departments, setDepartments] = useState([]);
    const [agencies, setAgencies] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
    const [filterDept, setFilterDept] = useState('');
    const [filterAgency, setFilterAgency] = useState('');
    const [sortBy, setSortBy] = useState('deadline_date');

    // Tabs: all | today | important | pinned
    const [tab, setTab] = useState('all');

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [editTask, setEditTask] = useState(null);

    // Bulk edit
    const [bulkMode, setBulkMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const filters = { status: filterStatus, search, department_id: filterDept, agency: filterAgency, sortBy };
            if (tab === 'today') filters.is_today = true;
            if (tab === 'pinned') filters.is_pinned = true;

            const [t, s, d, a, e] = await Promise.all([
                api.getTasks(filters),
                api.getTaskStats(),
                api.getDepartments(),
                api.getAgencies(),
                api.getEmployees()
            ]);
            setTasks(tab === 'important' ? t.filter(x => x.priority === 'High' || x.priority === 'Critical') : t);
            setStats(s);
            setDepartments(d);
            setAgencies(a);
            setEmployees(e);
        } catch (err) {
            console.error('Failed to load tasks', err);
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterDept, filterAgency, sortBy, tab, search]);

    useEffect(() => { load(); }, [filterStatus, filterDept, filterAgency, sortBy, tab]);

    const handleSearch = (e) => {
        if (e.key === 'Enter') load();
    };

    const handleSave = async (form) => {
        try {
            const payload = { ...form };
            if (payload.department_id === '') payload.department_id = null;
            else if (payload.department_id) payload.department_id = parseInt(payload.department_id);
            if (payload.assigned_employee_id === '') payload.assigned_employee_id = null;
            else if (payload.assigned_employee_id) payload.assigned_employee_id = parseInt(payload.assigned_employee_id);
            if (!payload.completion_date) delete payload.completion_date;
            if (editTask) await api.updateTask(editTask.id, payload);
            else await api.createTask(payload);
            setModalOpen(false);
            setEditTask(null);
            load();
        } catch (err) {
            alert('Error saving task: ' + (err?.response?.data?.detail || err.message));
        }
    };

    const handleUpdate = async (id, patch) => {
        await api.updateTask(id, patch);
        load();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this task?')) return;
        await api.deleteTask(id);
        load();
    };

    // Bulk actions
    const handleBulkStatus = async (status) => {
        const updates = selectedIds.map(id => ({ id, status, ...(status === 'Completed' ? { completion_date: new Date().toISOString().split('T')[0] } : {}) }));
        await api.bulkUpdateTasks(updates);
        setSelectedIds([]);
        load();
    };

    const handleBulkPriority = async (priority) => {
        const updates = selectedIds.map(id => ({ id, priority }));
        await api.bulkUpdateTasks(updates);
        setSelectedIds([]);
        load();
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedIds.length} tasks?`)) return;
        await Promise.all(selectedIds.map(id => api.deleteTask(id)));
        setSelectedIds([]);
        load();
    };

    const exportExcel = () => {
        const rows = tasks.map((t, i) => ({
            'S.No': i + 1,
            'Task #': t.task_number,
            'Description': t.description,
            'Steno Comment': t.steno_comment,
            'Assigned Agency': t.assigned_agency,
            'Allocated Date': t.allocated_date,
            'Time Given': t.time_given,
            'Deadline': t.deadline_date,
            'Status': t.status,
            'Priority': t.priority,
            'Completion Date': t.completion_date,
            'Remarks': t.remarks,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
        XLSX.writeFile(wb, `tasks_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const todayCount = tasks.filter(t => t.is_today).length;
    const importantCount = tasks.filter(t => t.priority === 'High' || t.priority === 'Critical').length;
    const pinnedCount = tasks.filter(t => t.is_pinned).length;

    return (
        <Layout user={user} onLogout={onLogout}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tight">Tasks</h1>
                    <p className="text-slate-500 dark:text-dark-muted mt-1 font-medium">Manage and track all assigned tasks</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={exportExcel}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-white/5 text-slate-700 dark:text-white font-bold rounded-full shadow-sm hover:shadow-md transition-all border border-slate-200 dark:border-white/10">
                        <FileDown size={16} /> Export
                    </button>
                    {user?.role === 'admin' && (
                        <>
                            <button onClick={() => { setBulkMode(b => !b); setSelectedIds([]); }}
                                className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-full shadow-sm hover:shadow-md transition-all border ${bulkMode
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-300'
                                    : 'bg-white dark:bg-white/5 text-slate-700 dark:text-white border-slate-200 dark:border-white/10'
                                    }`}>
                                <List size={16} /> Bulk Edit
                            </button>
                            <button onClick={() => { setEditTask(null); setModalOpen(true); }}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-700 text-white font-bold rounded-full shadow-lg shadow-indigo-500/25 hover:bg-indigo-800 transition-all hover:scale-105 transform">
                                <Plus size={18} strokeWidth={3} /> New Task
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Stat Cards */}
            <div className="flex flex-wrap gap-4 mb-8">
                <StatPill label="Total Tasks" value={stats.total} icon={ClipboardList} color="indigo" />
                <StatPill label="Completed" value={stats.completed} icon={CheckCircle2} color="emerald" />
                <StatPill label="Pending" value={stats.pending} icon={Clock} color="amber" />
                <StatPill label="Overdue" value={stats.overdue} icon={AlertTriangle} color="rose" />
                <StatPill label="Important" value={stats.important} icon={Flame} color="orange" />
            </div>

            <div className="mb-6">
                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {['all', 'today', 'important', 'pinned'].map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-5 py-2 text-sm font-bold rounded-full transition-all capitalize flex items-center gap-2 ${tab === t
                                ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-500/30'
                                : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'}`}>
                            {t} {t === 'all' && 'Tasks'}
                        </button>
                    ))}
                </div>

                {/* Filter Bar */}
                <div className="bg-white dark:bg-slate-800 rounded-full p-2 mb-6 flex flex-wrap gap-2 items-center shadow-sm border border-slate-100 dark:border-white/5">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearch}
                            placeholder="Search tasks by number, agency or keyword..."
                            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 transition-all" />
                    </div>

                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        className="px-4 py-2.5 rounded-full bg-slate-50 dark:bg-slate-900 border-none text-sm font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer">
                        <option value="">All Statuses</option>
                        {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>

                    <select value={filterAgency} onChange={e => setFilterAgency(e.target.value)}
                        className="px-4 py-2.5 rounded-full bg-slate-50 dark:bg-slate-900 border-none text-sm font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[150px] truncate">
                        <option value="">All Agencies</option>
                        {agencies.map(a => <option key={a}>{a}</option>)}
                    </select>

                    <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                        className="px-4 py-2.5 rounded-full bg-slate-50 dark:bg-slate-900 border-none text-sm font-bold text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer max-w-[150px] truncate">
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>

                    <button onClick={load} className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors ml-1" title="Refresh">
                        <RefreshCw size={18} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Bulk Edit Panel */}
            <AnimatePresence>
                {bulkMode && selectedIds.length > 0 && (
                    <BulkEditPanel
                        count={selectedIds.length}
                        onStatusChange={handleBulkStatus}
                        onPriorityChange={handleBulkPriority}
                        onDelete={handleBulkDelete}
                        onClear={() => setSelectedIds([])} />
                )}
            </AnimatePresence>

            {/* Table / Empty State */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="glass-card rounded-2xl h-14 animate-pulse" />
                    ))}
                </div>
            ) : tasks.length === 0 ? (
                <div className="glass-card rounded-3xl p-20 text-center">
                    <ClipboardList size={52} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-xl font-black text-slate-400 mb-2">No tasks found</p>
                    <p className="text-slate-300 text-sm">Try adjusting your filters or add a new task</p>
                    {user?.role === 'admin' && (
                        <button onClick={() => { setEditTask(null); setModalOpen(true); }}
                            className="mt-6 flex items-center gap-2 px-6 py-3 bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 transition-colors mx-auto">
                            <Plus size={18} /> Create First Task
                        </button>
                    )}
                </div>
            ) : (
                <div className="glass-card rounded-3xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                            {filterStatus && ` · ${filterStatus}`}
                            {tab !== 'all' && ` · ${tab}`}
                        </span>
                        {bulkMode && selectedIds.length > 0 && (
                            <span className="text-xs text-indigo-600 font-bold">{selectedIds.length} selected</span>
                        )}
                    </div>
                    <TaskTable
                        tasks={tasks}
                        departments={departments}
                        employees={employees}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        isAdmin={user?.role === 'admin'}
                        selectedIds={selectedIds}
                        onSelectChange={setSelectedIds}
                        bulkMode={bulkMode} />
                </div>
            )}

            {/* Task Modal */}
            <TaskModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditTask(null); }}
                onSave={handleSave}
                departments={departments}
                employees={employees}
                initial={editTask} />
        </Layout>
    );
};

export default Tasks;
