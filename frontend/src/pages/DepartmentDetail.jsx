import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Trash2, Edit2, Calendar, AlertTriangle,
    CheckCircle2, Clock, X, ChevronRight, RefreshCw, BookOpen,
    ListChecks, MessageCircle, Phone, MapPin, Users, Check,
    ChevronDown, CircleDot, RotateCcw, FileText
} from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { format, parseISO } from 'date-fns';

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

const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm";
const labelCls = "block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5";

// WhatsApp SVG
const WAIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// ── Agenda Status Badge ────────────────────────────────────────────────────────
const AgendaBadge = ({ status }) => {
    const map = {
        Open: 'bg-amber-100 text-amber-700 border border-amber-200',
        Done: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        Deferred: 'bg-slate-100 text-slate-500 border border-slate-200',
    };
    return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${map[status] || map.Open}`}>{status}</span>;
};

// ── Add Agenda Point — inline quick add ────────────────────────────────────────
const QuickAddAgenda = ({ onAdd, onCancel }) => {
    const [title, setTitle] = useState('');
    const [details, setDetails] = useState('');
    return (
        <div className="flex flex-col gap-2 bg-indigo-50/60 dark:bg-indigo-900/20 rounded-2xl p-3 border border-indigo-100 dark:border-indigo-500/20">
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Agenda point title *"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onAdd({ title: title.trim(), details: details.trim() }); if (e.key === 'Escape') onCancel(); }} />
            <input value={details} onChange={e => setDetails(e.target.value)}
                placeholder="Details / notes (optional)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            <div className="flex gap-2">
                <button onClick={onCancel} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={() => title.trim() && onAdd({ title: title.trim(), details: details.trim() })}
                    className="px-4 py-1.5 rounded-xl bg-indigo-700 text-white text-xs font-bold hover:bg-indigo-800">Add</button>
            </div>
        </div>
    );
};

// ── Schedule Meeting Modal ─────────────────────────────────────────────────────
const ScheduleMeetingModal = ({ isOpen, onClose, onSave, agenda = [], deptName = '' }) => {
    const today = new Date().toISOString().split('T')[0];
    const [form, setForm] = useState({ scheduled_date: today, venue: '', attendees: '', officer_phone: '', notes: '' });
    useEffect(() => { setForm({ scheduled_date: today, venue: '', attendees: '', officer_phone: '', notes: '' }); }, [isOpen]);

    if (!isOpen) return null;

    const openAgenda = agenda.filter(a => a.status === 'Open');

    // Build WhatsApp message preview
    const waMsg = `📋 *Meeting Agenda – ${deptName}*\n📅 Date: ${form.scheduled_date ? format(new Date(form.scheduled_date), 'd MMMM yyyy') : 'TBD'}${form.venue ? `\n📍 Venue: ${form.venue}` : ''}\n\n*Agenda Points:*\n${openAgenda.map((a, i) => `${i + 1}. ${a.title}${a.details ? `\n   → ${a.details}` : ''}`).join('\n')}\n\nPlease ensure your presence and come prepared.`;

    const waLink = form.officer_phone
        ? `https://wa.me/${form.officer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-lg shadow-premium-lg max-h-[92vh] overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">Schedule Meeting</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={20} className="text-slate-400" /></button>
                    </div>

                    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
                        <div>
                            <label className={labelCls}>Meeting Date *</label>
                            <input required type="date" value={form.scheduled_date}
                                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                                className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Venue</label>
                            <input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                                placeholder="e.g. Collectorate Conference Room" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Officer / Attendee Phone (WhatsApp)</label>
                            <input value={form.officer_phone} onChange={e => setForm(f => ({ ...f, officer_phone: e.target.value }))}
                                placeholder="91XXXXXXXXXX (with country code)" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Other Attendees</label>
                            <input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
                                placeholder="Comma-separated names" className={inputCls} />
                        </div>

                        {/* Agenda preview */}
                        {openAgenda.length > 0 && (
                            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Agenda Points to be sent ({openAgenda.length})</p>
                                <div className="space-y-1.5">
                                    {openAgenda.map((a, i) => (
                                        <div key={a.id} className="flex items-start gap-2 text-sm">
                                            <span className="text-indigo-500 font-bold text-xs mt-0.5">{i + 1}.</span>
                                            <div>
                                                <span className="text-slate-700 dark:text-slate-200 font-semibold">{a.title}</span>
                                                {a.details && <p className="text-xs text-slate-400 mt-0.5">{a.details}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {openAgenda.length === 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 text-sm text-amber-700 dark:text-amber-400">
                                No open agenda points. The meeting will be scheduled without agenda snapshot.
                            </div>
                        )}

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

                        {/* WhatsApp Send Button */}
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-lg shadow-emerald-500/20">
                            <WAIcon /> Send Agenda via WhatsApp
                        </a>
                        {!form.officer_phone && (
                            <p className="text-xs text-center text-slate-400">Add officer phone to send directly, or click to open WhatsApp and choose contact</p>
                        )}
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Meeting Card ───────────────────────────────────────────────────────────────
const MeetingCard = ({ meeting, onDelete, isAdmin, deptName }) => {
    const [open, setOpen] = useState(false);
    const statusStyle = {
        Scheduled: 'bg-indigo-100 text-indigo-700',
        Done: 'bg-emerald-100 text-emerald-700',
        Cancelled: 'bg-slate-100 text-slate-500',
    };

    const waMsg = `📋 *Meeting Reminder – ${deptName}*\n📅 ${format(new Date(meeting.scheduled_date), 'd MMMM yyyy')}${meeting.venue ? `\n📍 ${meeting.venue}` : ''}\n\n*Agenda:*\n${(meeting.agenda_snapshot || []).map((a, i) => `${i + 1}. ${a.title}`).join('\n')}`;
    const waLink = meeting.officer_phone
        ? `https://wa.me/${meeting.officer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                onClick={() => setOpen(o => !o)}>
                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {format(new Date(meeting.scheduled_date), 'd MMMM yyyy')}
                    </span>
                    {meeting.venue && <span className="text-xs text-slate-400 ml-2">· {meeting.venue}</span>}
                    {meeting.agenda_snapshot?.length > 0 && (
                        <span className="text-xs text-slate-400 ml-2">· {meeting.agenda_snapshot.length} agenda pts</span>
                    )}
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusStyle[meeting.status] || statusStyle.Scheduled}`}>{meeting.status}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-100 dark:border-white/10">
                        <div className="px-4 py-3">
                            {/* Previous agenda snapshot as tickets */}
                            {meeting.agenda_snapshot?.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Agenda at this meeting</p>
                                    <div className="flex flex-wrap gap-2">
                                        {meeting.agenda_snapshot.map((a, i) => (
                                            <div key={i} className="flex items-start gap-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/20 rounded-xl px-3 py-2 max-w-xs">
                                                <span className="text-indigo-400 font-bold text-xs mt-0.5">{i + 1}.</span>
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{a.title}</p>
                                                    {a.details && <p className="text-[10px] text-slate-400 mt-0.5">{a.details}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                                <a href={waLink} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-200 transition-colors">
                                    <WAIcon /> Resend WhatsApp
                                </a>
                                <button onClick={() => onDelete(meeting.id)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 text-xs font-semibold hover:bg-rose-100 transition-colors">
                                    <Trash2 size={11} /> Delete
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
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
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={20} className="text-slate-400" /></button>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); onSave({ ...form, department_id: departmentId }); }} className="space-y-4">
                        <div>
                            <label className={labelCls}>Program Name *</label>
                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Mid-Day Meal Scheme" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Review Frequency (days)</label>
                            <input type="number" min={1} max={365} value={form.review_frequency_days}
                                onChange={e => setForm({ ...form, review_frequency_days: parseInt(e.target.value) })}
                                className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Description</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={2} placeholder="Brief description..." className={inputCls + " resize-none"} />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                            <button type="submit" className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20">{initial ? 'Save' : 'Create'}</button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Schedule Review Session Modal (within a program) ───────────────────────────
const ScheduleReviewModal = ({ isOpen, onClose, onSave, programId }) => {
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
                        <h2 className="text-2xl font-black dark:text-white">Schedule Review Session</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={20} className="text-slate-400" /></button>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); onSave({ ...form, program_id: programId }); }} className="space-y-4">
                        <div>
                            <label className={labelCls}>Date *</label>
                            <input required type="date" value={form.scheduled_date}
                                onChange={e => setForm({ ...form, scheduled_date: e.target.value })} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Venue</label>
                            <input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })}
                                placeholder="e.g. Collectorate Conference Room" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Attendees</label>
                            <input value={form.attendees} onChange={e => setForm({ ...form, attendees: e.target.value })}
                                placeholder="Names separated by comma" className={inputCls} />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                            <button type="submit" className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20">Schedule</button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── DebtBadge ──────────────────────────────────────────────────────────────────
const DebtBadge = ({ status }) => {
    const map = { ok: 'bg-emerald-100 text-emerald-700', warning: 'bg-amber-100 text-amber-700', overdue: 'bg-rose-100 text-rose-700', never_reviewed: 'bg-slate-100 text-slate-500' };
    const labels = { ok: '✓ On Track', warning: '⚠ Due Soon', overdue: '✕ Overdue', never_reviewed: '— Never Reviewed' };
    return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${map[status] || map.never_reviewed}`}>{labels[status] || status}</span>;
};

// ── Main Page ──────────────────────────────────────────────────────────────────
const DepartmentDetail = ({ user, onLogout }) => {
    const { deptId } = useParams();
    const navigate = useNavigate();
    const deptIdInt = parseInt(deptId);

    const [dept, setDept] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [agenda, setAgenda] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [progModal, setProgModal] = useState(false);
    const [editProg, setEditProg] = useState(null);
    const [schedReviewModal, setSchedReviewModal] = useState(false);
    const [schedulingProgId, setSchedulingProgId] = useState(null);
    const [meetingModal, setMeetingModal] = useState(false);

    // Inline agenda add
    const [showAddAgenda, setShowAddAgenda] = useState(false);
    const [editingAgendaId, setEditingAgendaId] = useState(null);
    const [editingAgendaText, setEditingAgendaText] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [deptData, allSessions, agendaData, meetingsData] = await Promise.all([
                api.getDepartment(deptIdInt),
                api.getSessions(),
                api.getAgendaPoints(deptIdInt),
                api.getMeetings(deptIdInt),
            ]);
            setDept(deptData);
            const progIds = new Set((deptData.programs || []).map(p => p.id));
            setSessions(allSessions.filter(s => progIds.has(s.program_id)));
            setAgenda(agendaData);
            setMeetings(meetingsData);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [deptId]);

    // ── Agenda handlers ──────────────────────────────────────────────────────
    const handleAddAgenda = async ({ title, details }) => {
        await api.createAgendaPoint(deptIdInt, { title, details, order_index: agenda.length });
        setShowAddAgenda(false);
        const fresh = await api.getAgendaPoints(deptIdInt);
        setAgenda(fresh);
    };

    const handleToggleAgendaStatus = async (ap) => {
        const next = ap.status === 'Open' ? 'Done' : ap.status === 'Done' ? 'Deferred' : 'Open';
        await api.updateAgendaPoint(deptIdInt, ap.id, { status: next });
        setAgenda(prev => prev.map(a => a.id === ap.id ? { ...a, status: next } : a));
    };

    const handleDeleteAgenda = async (apId) => {
        if (!window.confirm('Remove this agenda point?')) return;
        await api.deleteAgendaPoint(deptIdInt, apId);
        setAgenda(prev => prev.filter(a => a.id !== apId));
    };

    const handleSaveAgendaEdit = async (ap) => {
        if (!editingAgendaText.trim()) return;
        await api.updateAgendaPoint(deptIdInt, ap.id, { title: editingAgendaText.trim() });
        setAgenda(prev => prev.map(a => a.id === ap.id ? { ...a, title: editingAgendaText.trim() } : a));
        setEditingAgendaId(null);
    };

    // ── Meeting handlers ─────────────────────────────────────────────────────
    const handleScheduleMeeting = async (form) => {
        await api.createMeeting(deptIdInt, form);
        setMeetingModal(false);
        const fresh = await api.getMeetings(deptIdInt);
        setMeetings(fresh);
    };

    const handleDeleteMeeting = async (id) => {
        if (!window.confirm('Delete this meeting?')) return;
        await api.deleteMeeting(deptIdInt, id);
        setMeetings(prev => prev.filter(m => m.id !== id));
    };

    // ── Program handlers ─────────────────────────────────────────────────────
    const handleSaveProgram = async (form) => {
        try {
            if (editProg) await api.updateProgram(editProg.id, form);
            else await api.createProgram(form);
            setProgModal(false); setEditProg(null); load();
        } catch { alert('Error saving program'); }
    };

    const handleDeleteProgram = async (id) => {
        if (!window.confirm('Delete this program and all its sessions?')) return;
        await api.deleteProgram(id); load();
    };

    const handleScheduleReview = async (form) => {
        try { await api.createSession(form); setSchedReviewModal(false); load(); }
        catch { alert('Error scheduling review'); }
    };

    if (loading) return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex items-center justify-center h-64"><RefreshCw size={32} className="animate-spin text-indigo-400" /></div>
        </Layout>
    );

    if (!dept) return (
        <Layout user={user} onLogout={onLogout}>
            <div className="text-center py-20 text-slate-400">Department not found.</div>
        </Layout>
    );

    const grad = colorGrad[dept.color] || colorGrad.indigo;
    const openAgenda = agenda.filter(a => a.status === 'Open');

    return (
        <Layout user={user} onLogout={onLogout}>
            {/* Back + Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/departments')}
                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-lg`}>
                    <span className="text-white font-black text-sm">{dept.short_name || dept.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                    <h1 className="text-3xl font-black dark:text-white">{dept.name}</h1>
                    {dept.head_name && <p className="text-sm text-slate-400">{dept.head_name}{dept.head_designation ? ` · ${dept.head_designation}` : ''}</p>}
                </div>
            </div>

            {/* New Grid Layout matching Sketch 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── TOP LEFT: Agenda / To Do ───────────────────────────────── */}
                <div className="glass-card rounded-3xl overflow-hidden flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <ListChecks size={20} className="text-indigo-500" />
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">Agenda / To Do</h2>
                            <span className="text-xs bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-full">{openAgenda.length} open</span>
                        </div>
                        <button onClick={() => setShowAddAgenda(true)}
                            className="flex items-center gap-1 p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-800/30 transition-colors">
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        <AnimatePresence>
                            {showAddAgenda && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                    <QuickAddAgenda onAdd={handleAddAgenda} onCancel={() => setShowAddAgenda(false)} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {agenda.length === 0 && !showAddAgenda && (
                            <div className="text-center py-8">
                                <p className="text-sm text-slate-400">No agenda points yet</p>
                            </div>
                        )}

                        {agenda.map((ap, i) => (
                            <div key={ap.id} className="group flex items-start gap-3 py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                                <span className="font-bold text-slate-400 w-5">{i + 1}.</span>
                                <div className="flex-1">
                                    {editingAgendaId === ap.id ? (
                                        <input autoFocus value={editingAgendaText} onChange={e => setEditingAgendaText(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveAgendaEdit(ap); if (e.key === 'Escape') setEditingAgendaId(null); }}
                                            onBlur={() => handleSaveAgendaEdit(ap)}
                                            className="w-full text-sm px-2 py-1 border border-indigo-300 bg-white" />
                                    ) : (
                                        <p className={`text-sm font-semibold text-slate-700 dark:text-slate-200 ${ap.status === 'Done' ? 'line-through opacity-50' : ''}`}>
                                            {ap.title}
                                        </p>
                                    )}
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                    <button onClick={() => handleToggleAgendaStatus(ap)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><Check size={14} /></button>
                                    <button onClick={() => { setEditingAgendaId(ap.id); setEditingAgendaText(ap.title); }} className="p-1 text-indigo-500 hover:bg-indigo-50 rounded"><Edit2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── TOP RIGHT: Targets (Programs) ────────────────────────── */}
                <div className="glass-card rounded-3xl overflow-hidden flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <BookOpen size={20} className="text-emerald-500" />
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">Targets</h2>
                        </div>
                        <button onClick={() => { setEditProg(null); setProgModal(true); }}
                            className="flex items-center gap-1 p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-800/30 transition-colors">
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 font-black">Program</th>
                                    <th className="px-4 py-3 font-black text-center whitespace-nowrap">Achieved<br />(as on date)</th>
                                    <th className="px-4 py-3 font-black text-center">Target</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {dept.programs?.length === 0 ? (
                                    <tr><td colSpan="3" className="text-center py-8 text-slate-400">No programs defined</td></tr>
                                ) : (
                                    dept.programs?.map((prog, i) => (
                                        <tr key={prog.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => { setEditProg(prog); setProgModal(true); }}>
                                            <td className="px-4 py-4 font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                                <span className="text-slate-400 font-bold">{i + 1}.</span>
                                                {prog.name}
                                            </td>
                                            <td className="px-4 py-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                {/* Placeholder for "Achieved" - derived from checklist or tasks in a real app */}
                                                --
                                            </td>
                                            <td className="px-4 py-4 text-center font-bold text-slate-600 dark:text-slate-300 border-l border-slate-100 dark:border-white/5">
                                                {/* Placeholder for "Target" */}
                                                --
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── BOTTOM LEFT: Meetings ─────────────────────────────────── */}
                <div className="glass-card rounded-3xl overflow-hidden min-h-[250px] flex flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <Calendar size={20} className="text-violet-500" />
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">Meetings</h2>
                        </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-3 relative">
                        {meetings.slice(0, 3).map((m, i) => (
                            <div key={m.id} className="flex items-center gap-3 py-1">
                                <span className="font-bold text-slate-400 w-5">{i + 1}.</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{format(new Date(m.scheduled_date), 'dd/MM/yyyy')}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10">{m.status}</span>
                            </div>
                        ))}
                        {meetings.length === 0 && <p className="text-slate-400 text-sm py-4">No meetings scheduled</p>}

                        <div className="absolute right-4 bottom-4">
                            <button onClick={() => setMeetingModal(true)}
                                className="flex flex-col items-center justify-center p-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-lg transition-all font-black text-sm text-center leading-tight hover:scale-105 active:scale-95">
                                <span>Schedule<br />New<br />Meeting</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── BOTTOM RIGHT: Last Meeting Minutes ───────────────────── */}
                <div className="glass-card rounded-3xl overflow-hidden min-h-[250px] relative">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <FileText size={20} className="text-amber-500" />
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">Last Meeting Minutes</h2>
                        </div>
                    </div>

                    <div className="p-5">
                        {sessions.length > 0 && sessions.filter(s => s.status === 'Completed').length > 0 ? (() => {
                            const lastMeeting = sessions.filter(s => s.status === 'Completed').sort((a, b) => new Date(b.actual_date || b.scheduled_date) - new Date(a.actual_date || a.scheduled_date))[0];
                            const noteLines = (lastMeeting.notes || "No notes recorded.").split('\n').filter(l => l.trim().length > 0);

                            return (
                                <>
                                    <div className="space-y-3 mb-16">
                                        {noteLines.slice(0, 2).map((line, idx) => (
                                            <div key={idx} className="flex items-start gap-2">
                                                <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{line}</p>
                                            </div>
                                        ))}
                                        {noteLines.length === 0 && <p className="text-sm text-slate-400">No notes recorded.</p>}
                                    </div>
                                    <button
                                        onClick={() => navigate(`/reviews/${lastMeeting.id}`)}
                                        className="absolute bottom-5 right-5 px-6 py-2.5 rounded-full border-2 border-amber-400 text-amber-600 dark:text-amber-400 font-black hover:bg-amber-50 dark:hover:bg-amber-400/10 transition-colors"
                                    >
                                        Details
                                    </button>
                                </>
                            );
                        })() : (
                            <p className="text-slate-400 text-sm">No completed meetings found to show minutes.</p>
                        )}
                    </div>
                </div>

            </div>

            {/* Modals */}
            <ProgramModal isOpen={progModal} onClose={() => { setProgModal(false); setEditProg(null); }}
                onSave={handleSaveProgram} departmentId={deptIdInt} initial={editProg} />
            <ScheduleReviewModal isOpen={schedReviewModal} onClose={() => setSchedReviewModal(false)}
                onSave={handleScheduleReview} programId={schedulingProgId} />
            <ScheduleMeetingModal isOpen={meetingModal} onClose={() => setMeetingModal(false)}
                onSave={handleScheduleMeeting} agenda={agenda} deptName={dept.name} />
        </Layout>
    );
};

export default DepartmentDetail;
