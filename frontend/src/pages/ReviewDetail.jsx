import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, CheckSquare, Square, Plus, Trash2, Edit2,
    X, ExternalLink, ClipboardList, AlertCircle, CheckCircle2,
    Calendar, Users, MapPin, FileText, Zap, RefreshCw
} from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { format, parseISO } from 'date-fns';

const STATUS_OPTIONS = ['Scheduled', 'Completed', 'Cancelled', 'Missed'];
const AP_STATUS_OPTIONS = ['Open', 'In Progress', 'Closed', 'Deferred'];
const PRIORITY_OPTIONS = ['Low', 'Normal', 'High', 'Critical'];

const priorityColor = {
    Critical: 'text-rose-600 bg-rose-50 border-rose-200',
    High: 'text-orange-600 bg-orange-50 border-orange-200',
    Normal: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    Low: 'text-slate-500 bg-slate-50 border-slate-200',
};

const apStatusColor = {
    Open: 'bg-amber-100 text-amber-700',
    'In Progress': 'bg-indigo-100 text-indigo-700',
    Closed: 'bg-emerald-100 text-emerald-700',
    Deferred: 'bg-slate-100 text-slate-500',
};

// ── Add Action Point Modal ─────────────────────────────────────────────────────
const APModal = ({ isOpen, onClose, onSave, sessionId, initial = null }) => {
    const today = new Date().toISOString().split('T')[0];
    const [form, setForm] = useState({ description: '', assigned_to: '', due_date: '', priority: 'Normal', remarks: '' });
    useEffect(() => {
        if (initial) setForm({ description: initial.description, assigned_to: initial.assigned_to || '', due_date: initial.due_date || '', priority: initial.priority || 'Normal', remarks: initial.remarks || '' });
        else setForm({ description: '', assigned_to: '', due_date: '', priority: 'Normal', remarks: '' });
    }, [initial, isOpen]);

    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-lg shadow-premium-lg">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">{initial ? 'Edit' : 'New'} Action Point</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={20} className="text-slate-400" /></button>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); onSave({ ...form, session_id: sessionId }); }} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Action Point *</label>
                            <textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={3} placeholder="Describe the action to be taken..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Assigned To</label>
                                <input value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                                    placeholder="Officer name"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Due Date</label>
                                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Priority</label>
                            <div className="flex gap-2">
                                {PRIORITY_OPTIONS.map(p => (
                                    <button type="button" key={p} onClick={() => setForm({ ...form, priority: p })}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${form.priority === p ? priorityColor[p] : 'bg-slate-50 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10'}`}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Remarks</label>
                            <input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}
                                placeholder="Optional remarks"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                            <button type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20">
                                {initial ? 'Save' : 'Add'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const ReviewDetail = ({ user, onLogout }) => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [apModal, setApModal] = useState(false);
    const [editAP, setEditAP] = useState(null);
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
        await api.updateSession(session.id, updates);
        setSaving(false);
        load();
    };

    const saveNotes = async () => {
        await api.updateSession(session.id, { notes, summary });
        setNotesEditing(false);
        load();
    };

    const handleAddAP = async (form) => {
        try {
            if (editAP) await api.updateActionPoint(editAP.id, form);
            else await api.createActionPoint(form);
            setApModal(false);
            setEditAP(null);
            load();
        } catch { alert('Error saving action point'); }
    };

    const handleDeleteAP = async (id) => {
        if (!window.confirm('Delete this action point?')) return;
        await api.deleteActionPoint(id);
        load();
    };

    const handleUpdateAP = async (id, updates) => {
        await api.updateActionPoint(id, updates);
        load();
    };

    const handleCreateTask = async (apId) => {
        setCreatingTask(apId);
        try {
            const result = await api.createTaskFromActionPoint(apId);
            alert(`✅ Task created: ${result.task_number}`);
            load();
        } catch (e) {
            alert(e.response?.data?.detail || 'Error creating task');
        } finally { setCreatingTask(null); }
    };

    const handleChecklistToggle = async (resp) => {
        await api.updateChecklistResponse(resp.id, { is_checked: !resp.is_checked, remarks: resp.remarks });
        load();
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

    const statusColor = {
        Completed: 'bg-emerald-100 text-emerald-700',
        Scheduled: 'bg-indigo-100 text-indigo-700',
        Missed: 'bg-rose-100 text-rose-700',
        Cancelled: 'bg-slate-100 text-slate-500',
    };

    const openAPs = session.action_points?.filter(ap => ap.status === 'Open') || [];
    const checkedItems = session.checklist?.filter(c => c.is_checked).length || 0;
    const totalItems = session.checklist?.length || 0;

    return (
        <Layout user={user} onLogout={onLogout}>
            {/* Header */}
            <div className="flex items-start gap-4 mb-8">
                <button onClick={() => navigate(-1)}
                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors mt-1">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h1 className="text-3xl font-black dark:text-white">{session.program_name}</h1>
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${statusColor[session.status] || statusColor.Scheduled}`}>
                            {session.status}
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm">{session.department_name}</p>
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
                {user?.role === 'admin' && (
                    <div className="flex gap-2 shrink-0">
                        {STATUS_OPTIONS.filter(s => s !== session.status).map(s => (
                            <button key={s} onClick={() => updateStatus(s)} disabled={saving}
                                className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">
                                Mark {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left: Action Points + Checklist */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Action Points */}
                    <div className="glass-card rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ClipboardList size={20} className="text-indigo-600" />
                                <h2 className="text-xl font-black dark:text-white">Action Points</h2>
                                {openAPs.length > 0 && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                        {openAPs.length} open
                                    </span>
                                )}
                            </div>
                            {user?.role === 'admin' && (
                                <button onClick={() => { setEditAP(null); setApModal(true); }}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-sm font-semibold hover:bg-indigo-100 transition-colors">
                                    <Plus size={14} /> Add
                                </button>
                            )}
                        </div>

                        {session.action_points?.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">
                                No action points recorded yet. Add them during or after the review.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/10">
                                {session.action_points.map(ap => (
                                    <div key={ap.id} className="p-5 group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold dark:text-white mb-1.5 ${ap.status === 'Closed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                    {ap.description}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${apStatusColor[ap.status]}`}>{ap.status}</span>
                                                    {ap.assigned_to && <span className="text-xs text-slate-400">→ {ap.assigned_to}</span>}
                                                    {ap.due_date && <span className="text-xs text-slate-400">by {format(parseISO(ap.due_date), 'd MMM yyyy')}</span>}
                                                    {ap.priority !== 'Normal' && (
                                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${priorityColor[ap.priority]}`}>{ap.priority}</span>
                                                    )}
                                                    {ap.linked_task_id && (
                                                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                                            <CheckCircle2 size={12} /> Task linked
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {user?.role === 'admin' && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    {/* Status quick-toggle */}
                                                    <select value={ap.status}
                                                        onChange={e => handleUpdateAP(ap.id, { status: e.target.value })}
                                                        className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-600 focus:outline-none">
                                                        {AP_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                                                    </select>
                                                    {!ap.linked_task_id && (
                                                        <button onClick={() => handleCreateTask(ap.id)} disabled={creatingTask === ap.id}
                                                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                                                            title="Convert to Task">
                                                            {creatingTask === ap.id ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                                                            Task
                                                        </button>
                                                    )}
                                                    <button onClick={() => { setEditAP(ap); setApModal(true); }}
                                                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors">
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button onClick={() => handleDeleteAP(ap.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Checklist */}
                    {session.checklist?.length > 0 && (
                        <div className="glass-card rounded-3xl overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckSquare size={20} className="text-indigo-600" />
                                    <h2 className="text-xl font-black dark:text-white">Review Checklist</h2>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                        {checkedItems}/{totalItems}
                                    </span>
                                </div>
                                {/* Progress bar */}
                                <div className="w-24 h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: totalItems > 0 ? `${(checkedItems / totalItems) * 100}%` : '0%' }}
                                        transition={{ duration: 0.8, ease: 'circOut' }}
                                        className="h-full bg-indigo-600 rounded-full"
                                    />
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-white/10">
                                {session.checklist.map(item => (
                                    <div key={item.id}
                                        onClick={() => user?.role === 'admin' && handleChecklistToggle(item)}
                                        className={`flex items-start gap-3 p-5 transition-colors ${user?.role === 'admin' ? 'cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/5' : ''}`}>
                                        {item.is_checked
                                            ? <CheckSquare size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                                            : <Square size={18} className="text-slate-300 shrink-0 mt-0.5" />
                                        }
                                        <div>
                                            <p className={`text-sm font-semibold ${item.is_checked ? 'line-through text-slate-400' : 'text-slate-700 dark:text-white'}`}>
                                                {item.title}
                                            </p>
                                            {item.description && (
                                                <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Notes & Info */}
                <div className="space-y-6">
                    {/* Meeting Notes */}
                    <div className="glass-card rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <FileText size={18} className="text-indigo-600" />
                                <h3 className="font-black text-slate-800 dark:text-white">Meeting Notes</h3>
                            </div>
                            {user?.role === 'admin' && (
                                <button onClick={() => notesEditing ? saveNotes() : setNotesEditing(true)}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${notesEditing ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
                                    {notesEditing ? 'Save' : 'Edit'}
                                </button>
                            )}
                        </div>
                        {notesEditing ? (
                            <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                rows={6} placeholder="Write meeting notes, decisions, discussions..."
                                className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none transition-all" />
                        ) : (
                            <p className={`text-sm leading-relaxed ${notes ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 italic'}`}>
                                {notes || 'No notes yet. Click Edit to add meeting notes.'}
                            </p>
                        )}
                    </div>

                    {/* Pre-meeting Brief / Summary */}
                    <div className="glass-card rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={18} className="text-indigo-600" />
                                <h3 className="font-black text-slate-800 dark:text-white">Brief / Summary</h3>
                            </div>
                            {user?.role === 'admin' && notesEditing && (
                                <span className="text-xs text-slate-400">Edit above to save both</span>
                            )}
                        </div>
                        {notesEditing ? (
                            <textarea value={summary} onChange={e => setSummary(e.target.value)}
                                rows={4} placeholder="Pre-meeting brief or post-session summary..."
                                className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none transition-all" />
                        ) : (
                            <p className={`text-sm leading-relaxed ${summary ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 italic'}`}>
                                {summary || 'No summary yet.'}
                            </p>
                        )}
                    </div>

                    {/* Quick Info */}
                    <div className="glass-card rounded-3xl p-6">
                        <h3 className="font-black text-slate-800 dark:text-white mb-4">Session Info</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Total Action Points</span>
                                <span className="font-bold dark:text-white">{session.action_points?.length || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Open</span>
                                <span className="font-bold text-amber-600">{openAPs.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Tasks Linked</span>
                                <span className="font-bold text-emerald-600">
                                    {session.action_points?.filter(ap => ap.linked_task_id).length || 0}
                                </span>
                            </div>
                            {session.actual_date && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Held On</span>
                                    <span className="font-bold dark:text-white">
                                        {format(parseISO(session.actual_date), 'd MMM yyyy')}
                                    </span>
                                </div>
                            )}
                        </div>
                        {user?.role === 'admin' && (
                            <button onClick={() => navigate('/tasks')}
                                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold text-sm hover:bg-indigo-100 transition-colors">
                                <ExternalLink size={14} /> View All Tasks
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <APModal isOpen={apModal} onClose={() => { setApModal(false); setEditAP(null); }}
                onSave={handleAddAP} sessionId={session.id} initial={editAP} />
        </Layout>
    );
};

export default ReviewDetail;
