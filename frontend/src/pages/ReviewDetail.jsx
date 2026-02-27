import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, CheckSquare, Square, Plus, Trash2, Edit2,
    X, ExternalLink, ClipboardList, AlertCircle, CheckCircle2,
    Calendar, Users, MapPin, FileText, Zap, RefreshCw, ChevronDown,
    ListChecks, Tag, ChevronRight, Clock, CircleDot
} from 'lucide-react';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import { format, parseISO } from 'date-fns';

const STATUS_OPTIONS = ['Scheduled', 'Completed', 'Cancelled', 'Missed'];
const AP_STATUS_OPTIONS = ['Open', 'In Progress', 'Closed', 'Deferred'];
const PRIORITY_OPTIONS = ['Low', 'Normal', 'High', 'Critical'];

const priorityColor = {
    Critical: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20',
    High: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20',
    Normal: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20',
    Low: 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/10',
};

const apStatusColor = {
    Open: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    'In Progress': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
    Closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    Deferred: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
};

const sessionStatusStyle = {
    Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    Scheduled: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
    Missed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    Cancelled: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
};

// ── Shared input class ─────────────────────────────────────────────────────────
const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm";
const labelCls = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";

// ── Add / Edit Action Point Modal ──────────────────────────────────────────────
const APModal = ({ isOpen, onClose, onSave, sessionId, initial = null }) => {
    const [form, setForm] = useState({ description: '', assigned_to: '', due_date: '', priority: 'Normal', remarks: '' });
    const [createTask, setCreateTask] = useState(false);

    useEffect(() => {
        if (initial) {
            setForm({
                description: initial.description,
                assigned_to: initial.assigned_to || '',
                due_date: initial.due_date || '',
                priority: initial.priority || 'Normal',
                remarks: initial.remarks || ''
            });
        } else {
            setForm({ description: '', assigned_to: '', due_date: '', priority: 'Normal', remarks: '' });
            setCreateTask(false);
        }
    }, [initial, isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="glass-card rounded-3xl w-full max-w-lg shadow-premium-lg overflow-hidden"
                >
                    {/* Modal Header */}
                    <div className="px-7 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-500/5 dark:to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <ClipboardList size={16} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black dark:text-white">{initial ? 'Edit' : 'New'} Action Point</h2>
                                <p className="text-xs text-slate-400">
                                    {initial ? 'Update action point details' : 'Record what needs to be done'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <form
                        onSubmit={e => { e.preventDefault(); onSave({ ...form, session_id: sessionId }, createTask && !initial); }}
                        className="px-7 py-6 space-y-4"
                    >
                        <div>
                            <label className={labelCls}>Action Point *</label>
                            <textarea
                                required autoFocus
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                placeholder="Describe the action that needs to be taken..."
                                className={inputCls + " resize-none"}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Assigned To</label>
                                <input
                                    value={form.assigned_to}
                                    onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                                    placeholder="Officer / Department"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Due Date</label>
                                <input
                                    type="date"
                                    value={form.due_date}
                                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Priority</label>
                            <div className="grid grid-cols-4 gap-2">
                                {PRIORITY_OPTIONS.map(p => (
                                    <button
                                        type="button" key={p}
                                        onClick={() => setForm({ ...form, priority: p })}
                                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${form.priority === p
                                            ? priorityColor[p]
                                            : 'bg-slate-50 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Remarks</label>
                            <input
                                value={form.remarks}
                                onChange={e => setForm({ ...form, remarks: e.target.value })}
                                placeholder="Optional notes or context"
                                className={inputCls}
                            />
                        </div>

                        {/* Create task toggle — only for new action points */}
                        {!initial && (
                            <div
                                onClick={() => setCreateTask(v => !v)}
                                className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${createTask
                                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/40'
                                    : 'border-slate-200 dark:border-white/10 hover:border-indigo-300'
                                    }`}
                            >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${createTask
                                    ? 'bg-indigo-600 border-indigo-600'
                                    : 'border-slate-300 dark:border-white/30'
                                    }`}>
                                    {createTask && <CheckCircle2 size={12} className="text-white" />}
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-bold ${createTask ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                        Also create a Task from this action point
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Action point will appear in your Task List for tracking
                                    </p>
                                </div>
                                <Zap size={16} className={createTask ? 'text-indigo-600' : 'text-slate-300'} />
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/25 text-sm flex items-center justify-center gap-2"
                            >
                                {initial ? 'Save Changes' : (createTask ? <><Zap size={14} /> Add & Create Task</> : 'Add Action Point')}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Edit Session Info Modal ────────────────────────────────────────────────────
const EditSessionModal = ({ isOpen, onClose, session, onSave }) => {
    const [form, setForm] = useState({ venue: '', attendees: '', scheduled_date: '' });

    useEffect(() => {
        if (session) {
            setForm({
                venue: session.venue || '',
                attendees: session.attendees || '',
                scheduled_date: session.scheduled_date || '',
            });
        }
    }, [session, isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="glass-card rounded-3xl w-full max-w-md shadow-premium-lg overflow-hidden"
                >
                    <div className="px-7 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-white/5 dark:to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-700 dark:bg-white/10 flex items-center justify-center">
                                <Edit2 size={15} className="text-white dark:text-white" />
                            </div>
                            <h2 className="text-lg font-black dark:text-white">Edit Session Details</h2>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                    <form
                        onSubmit={e => { e.preventDefault(); onSave(form); }}
                        className="px-7 py-6 space-y-4"
                    >
                        <div>
                            <label className={labelCls}>Scheduled Date</label>
                            <input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Venue / Location</label>
                            <input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} placeholder="Meeting room, platform, etc." className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Attendees</label>
                            <input value={form.attendees} onChange={e => setForm({ ...form, attendees: e.target.value })} placeholder="Comma-separated list of attendees" className={inputCls} />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors text-sm">
                                Cancel
                            </button>
                            <button type="submit"
                                className="flex-1 py-3 rounded-xl bg-slate-800 dark:bg-white dark:text-slate-900 text-white font-bold hover:bg-slate-900 transition-colors text-sm">
                                Save
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Main ReviewDetail component ────────────────────────────────────────────────
const ReviewDetail = ({ user, onLogout }) => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [apModal, setApModal] = useState(false);
    const [editAP, setEditAP] = useState(null);
    const [editSessionModal, setEditSessionModal] = useState(false);
    const [notes, setNotes] = useState('');
    const [summary, setSummary] = useState('');
    const [notesEditing, setNotesEditing] = useState(false);
    const [creatingTask, setCreatingTask] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.getSession(parseInt(sessionId));
            setSession(data);
            setNotes(data.notes || '');
            setSummary(data.summary || '');
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [sessionId]);

    const updateStatus = async (status) => {
        setSaving(true);
        const updates = { status };
        if (status === 'Completed' && !session.actual_date) {
            updates.actual_date = new Date().toISOString().split('T')[0];
        }
        try {
            await api.updateSession(session.id, updates);
            toast.success(`Session marked as ${status}`);
            load();
        } catch {
            toast.error('Failed to update status');
        } finally {
            setSaving(false);
        }
    };

    const saveNotes = async () => {
        try {
            await api.updateSession(session.id, { notes, summary });
            setNotesEditing(false);
            toast.success('Notes saved');
            load();
        } catch {
            toast.error('Failed to save notes');
        }
    };

    const handleAddAP = async (form, autoCreateTask = false) => {
        try {
            let ap;
            if (editAP) {
                await api.updateActionPoint(editAP.id, form);
                toast.success('Action point updated');
            } else {
                ap = await api.createActionPoint(form);
                if (autoCreateTask && ap?.id) {
                    const result = await api.createTaskFromActionPoint(ap.id);
                    toast.success(`Action point added & Task ${result.task_number} created`);
                } else {
                    toast.success('Action point added');
                }
            }
            setApModal(false);
            setEditAP(null);
            load();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error saving action point');
        }
    };

    const handleDeleteAP = async (id) => {
        if (!window.confirm('Delete this action point?')) return;
        try {
            await api.deleteActionPoint(id);
            toast.success('Action point deleted');
            load();
        } catch {
            toast.error('Failed to delete action point');
        }
    };

    const handleUpdateAP = async (id, updates) => {
        try {
            await api.updateActionPoint(id, updates);
            load();
        } catch {
            toast.error('Failed to update action point');
        }
    };

    const handleCreateTask = async (apId) => {
        setCreatingTask(apId);
        try {
            const result = await api.createTaskFromActionPoint(apId);
            toast.success(`Task ${result.task_number} created and linked!`);
            load();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error creating task');
        } finally { setCreatingTask(null); }
    };

    const handleChecklistToggle = async (resp) => {
        try {
            await api.updateChecklistResponse(resp.id, { is_checked: !resp.is_checked, remarks: resp.remarks });
            load();
        } catch {
            toast.error('Failed to update checklist');
        }
    };

    const handleEditSession = async (form) => {
        try {
            await api.updateSession(session.id, form);
            setEditSessionModal(false);
            toast.success('Session details updated');
            load();
        } catch {
            toast.error('Failed to update session');
        }
    };

    if (loading) return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex items-center justify-center h-64">
                <RefreshCw size={32} className="animate-spin text-indigo-400" />
            </div>
        </Layout>
    );

    if (!session) return (
        <Layout user={user} onLogout={onLogout}>
            <div className="text-center py-20 text-slate-400">Session not found.</div>
        </Layout>
    );

    const openAPs = session.action_points?.filter(ap => ap.status === 'Open') || [];
    const linkedTasks = session.action_points?.filter(ap => ap.linked_task_id).length || 0;
    const checkedItems = session.checklist?.filter(c => c.is_checked).length || 0;
    const totalItems = session.checklist?.length || 0;
    const unlinkedAPs = session.action_points?.filter(ap => !ap.linked_task_id && ap.status !== 'Closed') || [];

    return (
        <Layout user={user} onLogout={onLogout}>
            {/* ── Header ── */}
            <div className="flex items-start gap-4 mb-8">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors mt-1 shrink-0"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h1 className="text-3xl font-black dark:text-white truncate">{session.program_name}</h1>
                        <span className={`text-sm font-bold px-3 py-1 rounded-full shrink-0 ${sessionStatusStyle[session.status] || sessionStatusStyle.Scheduled}`}>
                            {session.status}
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium">{session.department_name}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <Calendar size={14} />
                            {format(parseISO(session.scheduled_date), 'EEEE, d MMMM yyyy')}
                        </span>
                        {session.venue && (
                            <span className="flex items-center gap-1.5"><MapPin size={14} />{session.venue}</span>
                        )}
                        {session.attendees && (
                            <span className="flex items-center gap-1.5"><Users size={14} />{session.attendees}</span>
                        )}
                    </div>
                </div>
                {/* Status change buttons + edit session */}
                {user?.role === 'admin' && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <button
                            onClick={() => setEditSessionModal(true)}
                            className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center gap-1.5"
                        >
                            <Edit2 size={13} /> Edit
                        </button>
                        {STATUS_OPTIONS.filter(s => s !== session.status).map(s => (
                            <button
                                key={s} onClick={() => updateStatus(s)} disabled={saving}
                                className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                            >
                                Mark {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Stats Strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Action Points', value: session.action_points?.length || 0, icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                    { label: 'Open', value: openAPs.length, icon: CircleDot, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
                    { label: 'Tasks Linked', value: linkedTasks, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                    { label: 'Checklist', value: `${checkedItems}/${totalItems}`, icon: ListChecks, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className={`glass-card rounded-2xl p-4 flex items-center gap-3`}>
                        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                            <Icon size={18} className={color} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-medium">{label}</p>
                            <p className={`text-xl font-black ${color}`}>{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── "Convert to Task" nudge banner (if there are open unlinked APs) ── */}
            {user?.role === 'admin' && unlinkedAPs.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-3"
                >
                    <Zap size={18} className="text-indigo-600 shrink-0" />
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex-1">
                        {unlinkedAPs.length} action point{unlinkedAPs.length > 1 ? 's' : ''} not yet converted to tasks.
                        Click <span className="font-black">→ Task</span> on any row to add it to your Task List for tracking.
                    </p>
                    <button
                        onClick={() => navigate('/tasks')}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline shrink-0"
                    >
                        View Tasks <ChevronRight size={12} />
                    </button>
                </motion.div>
            )}

            <div className="space-y-8">
                {/* ── Action Points (full width) ── */}
                <div className="glass-card rounded-3xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-transparent dark:from-indigo-500/5">
                        <div className="flex items-center gap-3">
                            <ClipboardList size={20} className="text-indigo-600" />
                            <h2 className="text-xl font-black dark:text-white">Action Points</h2>
                            {openAPs.length > 0 && (
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                                    {openAPs.length} open
                                </span>
                            )}
                        </div>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => { setEditAP(null); setApModal(true); }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-700 text-white text-sm font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                <Plus size={15} /> Add Action Point
                            </button>
                        )}
                    </div>

                    {session.action_points?.length === 0 ? (
                        <div className="p-12 text-center">
                            <ClipboardList size={40} className="text-slate-200 dark:text-white/10 mx-auto mb-3" />
                            <p className="text-slate-400 font-semibold">No action points yet</p>
                            <p className="text-sm text-slate-400 mt-1">Add action points during or after the review session.</p>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => { setEditAP(null); setApModal(true); }}
                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-700 text-white text-sm font-bold hover:bg-indigo-800 transition-colors"
                                >
                                    <Plus size={14} /> Add First Action Point
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-white/5">
                                    <tr>
                                        <th className="px-5 py-3 text-xs font-black text-slate-400 uppercase tracking-wider text-center w-12">#</th>
                                        <th className="px-5 py-3 text-xs font-black text-slate-400 uppercase tracking-wider">Action Point</th>
                                        <th className="px-5 py-3 text-xs font-black text-slate-400 uppercase tracking-wider">Priority</th>
                                        <th className="px-5 py-3 text-xs font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Due Date</th>
                                        <th className="px-5 py-3 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                                        {user?.role === 'admin' && (
                                            <th className="px-5 py-3 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {session.action_points.map((ap, idx) => (
                                        <tr key={ap.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-5 py-4 font-bold text-slate-300 text-center text-xs">{idx + 1}</td>
                                            <td className="px-5 py-4">
                                                <p className={`font-semibold dark:text-white ${ap.status === 'Closed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                    {ap.description}
                                                </p>
                                                {ap.assigned_to && (
                                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-semibold flex items-center gap-1">
                                                        <Users size={10} /> {ap.assigned_to}
                                                    </p>
                                                )}
                                                {ap.remarks && (
                                                    <p className="text-xs text-slate-400 mt-0.5 italic">{ap.remarks}</p>
                                                )}
                                                {ap.linked_task_id && (
                                                    <button
                                                        onClick={() => navigate('/tasks')}
                                                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 hover:underline"
                                                    >
                                                        <CheckCircle2 size={11} /> Task linked — view in Tasks
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${priorityColor[ap.priority] || priorityColor.Normal}`}>
                                                    {ap.priority}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap text-sm">
                                                {ap.due_date ? format(parseISO(ap.due_date), 'd MMM yyyy') : '—'}
                                            </td>
                                            <td className="px-5 py-4">
                                                {user?.role === 'admin' ? (
                                                    <select
                                                        value={ap.status}
                                                        onChange={e => handleUpdateAP(ap.id, { status: e.target.value })}
                                                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer hover:border-indigo-300 font-semibold"
                                                    >
                                                        {AP_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                                                    </select>
                                                ) : (
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${apStatusColor[ap.status]}`}>
                                                        {ap.status}
                                                    </span>
                                                )}
                                            </td>
                                            {user?.role === 'admin' && (
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Convert to Task — always visible, prominent */}
                                                        {!ap.linked_task_id ? (
                                                            <button
                                                                onClick={() => handleCreateTask(ap.id)}
                                                                disabled={creatingTask === ap.id}
                                                                title="Convert to Task"
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors text-xs font-bold border border-indigo-200 dark:border-indigo-500/20"
                                                            >
                                                                {creatingTask === ap.id
                                                                    ? <RefreshCw size={12} className="animate-spin" />
                                                                    : <Zap size={12} />
                                                                }
                                                                → Task
                                                            </button>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold px-2">
                                                                <CheckCircle2 size={12} /> Linked
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => { setEditAP(ap); setApModal(true); }}
                                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAP(ap.id)}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Bottom section: Notes + Info + Checklist ── */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Meeting Notes */}
                    <div className="glass-card rounded-3xl overflow-hidden lg:col-span-2">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText size={18} className="text-indigo-600" />
                                <h3 className="font-black text-slate-800 dark:text-white">Notes & Summary</h3>
                            </div>
                            {user?.role === 'admin' && (
                                <div className="flex gap-2">
                                    {notesEditing && (
                                        <button
                                            onClick={() => { setNotesEditing(false); setNotes(session.notes || ''); setSummary(session.summary || ''); }}
                                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        onClick={() => notesEditing ? saveNotes() : setNotesEditing(true)}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${notesEditing
                                            ? 'bg-indigo-700 text-white hover:bg-indigo-800 shadow-md shadow-indigo-500/20'
                                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                                            }`}
                                    >
                                        {notesEditing ? 'Save Notes' : 'Edit'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Meeting Notes</p>
                                {notesEditing ? (
                                    <textarea
                                        value={notes} onChange={e => setNotes(e.target.value)}
                                        rows={5} placeholder="Write meeting notes, decisions, discussions..."
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none transition-all"
                                    />
                                ) : (
                                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${notes ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 italic'}`}>
                                        {notes || 'No notes yet. Click Edit to add.'}
                                    </p>
                                )}
                            </div>
                            <div className="border-t border-slate-100 dark:border-white/10 pt-5">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Brief / Summary</p>
                                {notesEditing ? (
                                    <textarea
                                        value={summary} onChange={e => setSummary(e.target.value)}
                                        rows={3} placeholder="Pre-meeting brief or post-session summary..."
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none transition-all"
                                    />
                                ) : (
                                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${summary ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 italic'}`}>
                                        {summary || 'No summary yet.'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right column: Session Info + Checklist */}
                    <div className="space-y-5">
                        {/* Session Info */}
                        <div className="glass-card rounded-3xl p-5">
                            <h3 className="font-black text-slate-800 dark:text-white mb-4 text-sm uppercase tracking-wider text-slate-400">Session Info</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Status</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sessionStatusStyle[session.status]}`}>
                                        {session.status}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Action Points</span>
                                    <span className="font-bold dark:text-white">{session.action_points?.length || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Open</span>
                                    <span className="font-bold text-amber-600">{openAPs.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Tasks Created</span>
                                    <span className="font-bold text-emerald-600">{linkedTasks}</span>
                                </div>
                                {session.actual_date && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Held On</span>
                                        <span className="font-bold dark:text-white text-xs">
                                            {format(parseISO(session.actual_date), 'd MMM yyyy')}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => navigate('/tasks')}
                                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold text-sm hover:bg-indigo-100 transition-colors"
                                >
                                    <ExternalLink size={13} /> View All Tasks
                                </button>
                            )}
                        </div>

                        {/* Checklist */}
                        {session.checklist?.length > 0 && (
                            <div className="glass-card rounded-3xl overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ListChecks size={16} className="text-indigo-600" />
                                        <h3 className="font-black text-slate-800 dark:text-white text-sm">Checklist</h3>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                                            {checkedItems}/{totalItems}
                                        </span>
                                    </div>
                                    <div className="w-16 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: totalItems > 0 ? `${(checkedItems / totalItems) * 100}%` : '0%' }}
                                            transition={{ duration: 0.8, ease: 'circOut' }}
                                            className="h-full bg-indigo-600 rounded-full"
                                        />
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-white/10 max-h-64 overflow-y-auto">
                                    {session.checklist.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => user?.role === 'admin' && handleChecklistToggle(item)}
                                            className={`flex items-start gap-3 px-5 py-3 transition-colors ${user?.role === 'admin' ? 'cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/5' : ''}`}
                                        >
                                            {item.is_checked
                                                ? <CheckSquare size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                                                : <Square size={16} className="text-slate-300 shrink-0 mt-0.5" />
                                            }
                                            <p className={`text-sm font-medium ${item.is_checked ? 'line-through text-slate-400' : 'text-slate-700 dark:text-white'}`}>
                                                {item.title}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <APModal
                isOpen={apModal}
                onClose={() => { setApModal(false); setEditAP(null); }}
                onSave={handleAddAP}
                sessionId={session.id}
                initial={editAP}
            />
            <EditSessionModal
                isOpen={editSessionModal}
                onClose={() => setEditSessionModal(false)}
                session={session}
                onSave={handleEditSession}
            />
        </Layout>
    );
};

export default ReviewDetail;
