import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Trash2, Edit2, Calendar, AlertTriangle,
    CheckCircle2, Clock, X, ChevronRight, RefreshCw, BookOpen
} from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { format, parseISO, differenceInDays } from 'date-fns';

const colorGrad = {
    indigo: 'from-indigo-500 to-indigo-700',
    emerald: 'from-emerald-500 to-emerald-700',
    amber: 'from-amber-500 to-amber-700',
    rose: 'from-rose-500 to-rose-700',
    sky: 'from-sky-500 to-sky-700',
    violet: 'from-violet-500 to-violet-700',
    teal: 'from-teal-500 to-teal-700',
    orange: 'from-orange-500 to-orange-700',
};

const DebtBadge = ({ status }) => {
    const map = {
        ok: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700',
        overdue: 'bg-rose-100 text-rose-700',
        never_reviewed: 'bg-slate-100 text-slate-500',
    };
    const labels = {
        ok: '✓ On Track',
        warning: '⚠ Due Soon',
        overdue: '✕ Overdue',
        never_reviewed: '— Never Reviewed',
    };
    return (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${map[status] || map.never_reviewed}`}>
            {labels[status] || status}
        </span>
    );
};

// ── Program Modal ──────────────────────────────────────────────────────────────
const ProgramModal = ({ isOpen, onClose, onSave, departmentId, initial = null }) => {
    const [form, setForm] = useState({ name: '', description: '', review_frequency_days: 15 });
    useEffect(() => {
        if (initial) setForm({ name: initial.name, description: initial.description || '', review_frequency_days: initial.review_frequency_days });
        else setForm({ name: '', description: '', review_frequency_days: 15 });
    }, [initial, isOpen]);

    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-md shadow-premium-lg">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">{initial ? 'Edit' : 'New'} Review Program</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); onSave({ ...form, department_id: departmentId }); }} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Program Name *</label>
                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Mid-Day Meal Scheme"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Review Frequency (days)</label>
                            <input type="number" min={1} max={365} value={form.review_frequency_days}
                                onChange={e => setForm({ ...form, review_frequency_days: parseInt(e.target.value) })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                            <p className="text-xs text-slate-400 mt-1">Alert triggers when review is overdue by this many days</p>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Description</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={2} placeholder="Brief description..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
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

// ── Schedule Session Modal ─────────────────────────────────────────────────────
const ScheduleModal = ({ isOpen, onClose, onSave, programId }) => {
    const today = new Date().toISOString().split('T')[0];
    const [form, setForm] = useState({ scheduled_date: today, venue: '', attendees: '' });
    useEffect(() => { setForm({ scheduled_date: today, venue: '', attendees: '' }); }, [isOpen]);

    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-md shadow-premium-lg">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">Schedule Review</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); onSave({ ...form, program_id: programId }); }} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Date *</label>
                            <input required type="date" value={form.scheduled_date}
                                onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Venue</label>
                            <input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })}
                                placeholder="e.g. Collectorate Conference Room"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Attendees</label>
                            <input value={form.attendees} onChange={e => setForm({ ...form, attendees: e.target.value })}
                                placeholder="Names separated by comma"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20">
                                Schedule
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const DepartmentDetail = ({ user, onLogout }) => {
    const { deptId } = useParams();
    const navigate = useNavigate();
    const [dept, setDept] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progModal, setProgModal] = useState(false);
    const [editProg, setEditProg] = useState(null);
    const [schedModal, setSchedModal] = useState(false);
    const [schedulingProgId, setSchedulingProgId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [deptData, allSessions] = await Promise.all([
                api.getDepartment(parseInt(deptId)),
                api.getSessions()
            ]);
            setDept(deptData);
            // Filter sessions that belong to this department's programs
            const progIds = new Set((deptData.programs || []).map(p => p.id));
            setSessions(allSessions.filter(s => progIds.has(s.program_id)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [deptId]);

    const handleSaveProgram = async (form) => {
        try {
            if (editProg) await api.updateProgram(editProg.id, form);
            else await api.createProgram(form);
            setProgModal(false);
            setEditProg(null);
            load();
        } catch { alert('Error saving program'); }
    };

    const handleDeleteProgram = async (id) => {
        if (!window.confirm('Delete this program and all its sessions?')) return;
        await api.deleteProgram(id);
        load();
    };

    const handleSchedule = async (form) => {
        try {
            await api.createSession(form);
            setSchedModal(false);
            load();
        } catch { alert('Error scheduling review'); }
    };

    if (loading) return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex items-center justify-center h-64">
                <RefreshCw size={32} className="animate-spin text-indigo-400" />
            </div>
        </Layout>
    );

    if (!dept) return (
        <Layout user={user} onLogout={onLogout}>
            <div className="text-center py-20 text-slate-400">Department not found.</div>
        </Layout>
    );

    const grad = colorGrad[dept.color] || colorGrad.indigo;

    return (
        <Layout user={user} onLogout={onLogout}>
            {/* Back + Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/departments')}
                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-lg`}>
                    <span className="text-white font-black text-sm">
                        {dept.short_name || dept.name.slice(0, 2).toUpperCase()}
                    </span>
                </div>
                <div>
                    <h1 className="text-3xl font-black dark:text-white">{dept.name}</h1>
                    {dept.head_name && (
                        <p className="text-sm text-slate-400">{dept.head_name} · {dept.head_designation}</p>
                    )}
                </div>
                {user?.role === 'admin' && (
                    <button onClick={() => { setEditProg(null); setProgModal(true); }}
                        className="ml-auto flex items-center gap-2 px-5 py-3 bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 transition-colors">
                        <Plus size={18} /> Add Program
                    </button>
                )}
            </div>

            {/* Programs */}
            {dept.programs?.length === 0 ? (
                <div className="glass-card rounded-3xl p-16 text-center">
                    <BookOpen size={48} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-lg font-black text-slate-400">No review programs yet</p>
                    <p className="text-slate-400 mt-1 mb-6 text-sm">Add programs to start tracking reviews</p>
                    {user?.role === 'admin' && (
                        <button onClick={() => { setEditProg(null); setProgModal(true); }}
                            className="px-6 py-3 bg-indigo-700 text-white rounded-2xl font-bold shadow-lg">
                            <Plus size={16} className="inline mr-2" /> Add Program
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {dept.programs.map((prog, i) => {
                        // Filter sessions for this program
                        const progSessions = sessions
                            .filter(s => s.program_id === prog.id)
                            .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));

                        return (
                            <motion.div key={prog.id}
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                className="glass-card rounded-3xl overflow-hidden">
                                {/* Program Header */}
                                <div className="p-6 border-b border-slate-100 dark:border-white/10">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h2 className="text-xl font-black dark:text-white">{prog.name}</h2>
                                                <DebtBadge status={prog.debt_status} />
                                            </div>
                                            {prog.description && (
                                                <p className="text-sm text-slate-400 mt-1">{prog.description}</p>
                                            )}
                                            <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-400">
                                                <span>Every {prog.review_frequency_days} days</span>
                                                {prog.last_review && (
                                                    <span>Last: {format(parseISO(prog.last_review), 'd MMM yyyy')}</span>
                                                )}
                                                {prog.days_since_last_review !== null && prog.days_since_last_review !== undefined && (
                                                    <span className={prog.debt_status === 'overdue' ? 'text-rose-500 font-semibold' : prog.debt_status === 'warning' ? 'text-amber-500 font-semibold' : ''}>
                                                        {prog.days_since_last_review} days ago
                                                    </span>
                                                )}
                                                {prog.next_scheduled && (
                                                    <span className="text-indigo-500 font-semibold">
                                                        Next: {format(parseISO(prog.next_scheduled), 'd MMM yyyy')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            {user?.role === 'admin' && (
                                                <>
                                                    <button onClick={() => { setSchedulingProgId(prog.id); setSchedModal(true); }}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-sm font-semibold hover:bg-indigo-100 transition-colors">
                                                        <Calendar size={14} /> Schedule
                                                    </button>
                                                    <button onClick={() => { setEditProg(prog); setProgModal(true); }}
                                                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors">
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button onClick={() => handleDeleteProgram(prog.id)}
                                                        className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Sessions List */}
                                <div className="p-4">
                                    {progSessions.length === 0 ? (
                                        <p className="text-center text-sm text-slate-400 py-4">No review sessions yet. Schedule one to get started.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {progSessions.slice(0, 4).map(session => (
                                                <div key={session.id}
                                                    onClick={() => navigate(`/reviews/${session.id}`)}
                                                    className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                                        session.status === 'Completed' ? 'bg-emerald-500' :
                                                        session.status === 'Scheduled' ? 'bg-indigo-500' :
                                                        session.status === 'Missed' ? 'bg-rose-500' : 'bg-slate-300'
                                                    }`} />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-semibold text-slate-700 dark:text-white">
                                                            {format(parseISO(session.scheduled_date), 'd MMMM yyyy')}
                                                        </span>
                                                        {session.venue && (
                                                            <span className="text-xs text-slate-400 ml-2">· {session.venue}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                                        <span className={`px-2 py-0.5 rounded-full font-semibold ${
                                                            session.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                                            session.status === 'Scheduled' ? 'bg-indigo-100 text-indigo-700' :
                                                            session.status === 'Missed' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                                                        }`}>{session.status}</span>
                                                        {session.open_action_points > 0 && (
                                                            <span className="text-amber-600 font-semibold">{session.open_action_points} open AP</span>
                                                        )}
                                                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                                                    </div>
                                                </div>
                                            ))}
                                            {progSessions.length > 4 && (
                                                <button onClick={() => navigate(`/reviews/${progSessions[0].id}`)}
                                                    className="w-full text-center text-xs text-indigo-600 font-semibold py-2 hover:underline">
                                                    +{progSessions.length - 4} more sessions
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <ProgramModal isOpen={progModal} onClose={() => { setProgModal(false); setEditProg(null); }}
                onSave={handleSaveProgram} departmentId={parseInt(deptId)} initial={editProg} />
            <ScheduleModal isOpen={schedModal} onClose={() => setSchedModal(false)}
                onSave={handleSchedule} programId={schedulingProgId} />
        </Layout>
    );
};

export default DepartmentDetail;
