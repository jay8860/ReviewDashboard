import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Trash2, Edit2, Calendar, AlertTriangle,
    CheckCircle2, Clock, X, RefreshCw, BookOpen,
    ListChecks, MessageCircle, Phone, MapPin, Users, Check,
    ChevronDown, FileText, Table2, Upload, Download,
    Save, PlusCircle, Minus, GripVertical, MoreHorizontal
} from 'lucide-react';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import { format } from 'date-fns';

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

// WhatsApp SVG
const WAIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// ── Agenda Status Badge ────────────────────────────────────────────────────────
const AgendaBadge = ({ status }) => {
    const map = {
        Open: 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400',
        Done: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400',
        Deferred: 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-white/10 dark:text-slate-400',
    };
    return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${map[status] || map.Open}`}>{status}</span>;
};

// ── Schedule Meeting Modal ─────────────────────────────────────────────────────
const ScheduleMeetingModal = ({ isOpen, onClose, onSave, agenda = [], deptName = '' }) => {
    const today = new Date().toISOString().split('T')[0];
    const [form, setForm] = useState({ scheduled_date: today, venue: '', attendees: '', officer_phone: '', notes: '' });
    useEffect(() => { setForm({ scheduled_date: today, venue: '', attendees: '', officer_phone: '', notes: '' }); }, [isOpen]);

    if (!isOpen) return null;

    const openAgenda = agenda.filter(a => a.status === 'Open');

    const waMsg = `📋 *Meeting Agenda – ${deptName}*\n📅 Date: ${form.scheduled_date ? format(new Date(form.scheduled_date), 'd MMMM yyyy') : 'TBD'}${form.venue ? `\n📍 Venue: ${form.venue}` : ''}\n\n*Agenda Points:*\n${openAgenda.map((a, i) => `${i + 1}. ${a.title}${a.details ? `\n   → ${a.details}` : ''}`).join('\n')}\n\nPlease ensure your presence and come prepared.`;

    const waLink = form.officer_phone
        ? `https://wa.me/${form.officer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="glass-card rounded-3xl w-full max-w-lg shadow-premium-lg max-h-[92vh] overflow-y-auto custom-scrollbar">
                    <div className="px-7 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-500/5 dark:to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <Calendar size={16} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black dark:text-white">Schedule Meeting</h2>
                                <p className="text-xs text-slate-400">{deptName} — Department-wide meeting</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} className="text-slate-400" /></button>
                    </div>

                    <div className="p-7 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Date *</label>
                                <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Venue</label>
                                <input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="Meeting room / location"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Attendees</label>
                            <input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} placeholder="Comma separated names"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Officer WhatsApp</label>
                            <input value={form.officer_phone} onChange={e => setForm(f => ({ ...f, officer_phone: e.target.value }))} placeholder="+91XXXXXXXXXX"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Notes</label>
                            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Meeting notes or agenda details..." rows={3}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm resize-none" />
                        </div>

                        {/* Preview open agenda to be auto-snapshotted */}
                        {openAgenda.length > 0 && (
                            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-4">
                                <p className="text-xs font-black uppercase text-slate-400 mb-2">Agenda snapshot ({openAgenda.length} open items)</p>
                                <div className="space-y-1">
                                    {openAgenda.slice(0, 4).map((a, i) => (
                                        <p key={a.id} className="text-xs text-slate-600 dark:text-slate-300">
                                            <span className="font-bold text-slate-400">{i + 1}.</span> {a.title}
                                        </p>
                                    ))}
                                    {openAgenda.length > 4 && <p className="text-xs text-slate-400">+{openAgenda.length - 4} more…</p>}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button onClick={onClose} className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
                            <a href={waLink} target="_blank" rel="noreferrer"
                                className="px-4 py-3 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors flex items-center gap-2">
                                <WAIcon /> WA
                            </a>
                            <button onClick={() => form.scheduled_date && onSave(form)}
                                className="flex-1 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors">
                                Schedule
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Meeting Detail Modal ───────────────────────────────────────────────────────
const MeetingDetailModal = ({ meeting, onClose, onDelete, onStatusChange }) => {
    if (!meeting) return null;
    const statusColors = {
        Scheduled: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
        Done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
        Cancelled: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
    };
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="glass-card rounded-3xl w-full max-w-lg shadow-premium-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black dark:text-white">Meeting Details</h2>
                            <p className="text-xs text-slate-400">{format(new Date(meeting.scheduled_date), 'd MMMM yyyy')}</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} className="text-slate-400" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-xs font-black px-3 py-1 rounded-full ${statusColors[meeting.status] || statusColors.Scheduled}`}>{meeting.status}</span>
                            {meeting.venue && <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{meeting.venue}</span>}
                            {meeting.attendees && <span className="flex items-center gap-1 text-xs text-slate-500"><Users size={12} />{meeting.attendees}</span>}
                        </div>

                        {meeting.notes && (
                            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4">
                                <p className="text-xs font-black uppercase text-slate-400 mb-2">Notes</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">{meeting.notes}</p>
                            </div>
                        )}

                        {meeting.agenda_snapshot && meeting.agenda_snapshot.length > 0 && (
                            <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/15 p-4">
                                <p className="text-xs font-black uppercase text-indigo-500 mb-2">Agenda at time of scheduling</p>
                                <div className="space-y-1.5">
                                    {meeting.agenda_snapshot.map((item, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <span className="text-xs font-bold text-indigo-300 w-4">{i + 1}.</span>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.title}</p>
                                                {item.details && <p className="text-xs text-slate-400">{item.details}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2 flex-wrap">
                            {meeting.status === 'Scheduled' && (
                                <button onClick={() => onStatusChange(meeting.id, 'Done')}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5">
                                    <Check size={14} /> Mark Done
                                </button>
                            )}
                            {meeting.status !== 'Cancelled' && (
                                <button onClick={() => onStatusChange(meeting.id, 'Cancelled')}
                                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 transition-colors">
                                    Cancel Meeting
                                </button>
                            )}
                            <button onClick={() => onDelete(meeting.id)}
                                className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-bold hover:bg-rose-100 transition-colors flex items-center gap-1.5 ml-auto">
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Program (Targets) Modal ────────────────────────────────────────────────────
const ProgramModal = ({ isOpen, onClose, onSave, departmentId, initial }) => {
    const blank = { name: '', description: '', review_frequency_days: 30, target_value: '', achieved_value: '', department_id: departmentId };
    const [form, setForm] = useState(blank);
    useEffect(() => { setForm(initial ? { ...initial } : { ...blank, department_id: departmentId }); }, [isOpen, initial]);

    if (!isOpen) return null;
    const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
    const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm";
    const labelCls = "block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5";

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="glass-card rounded-3xl w-full max-w-md shadow-premium-lg max-h-[92vh] overflow-y-auto custom-scrollbar">
                    <div className="px-7 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                        <h2 className="text-lg font-black dark:text-white">{initial ? 'Edit Program' : 'New Review Program'}</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} className="text-slate-400" /></button>
                    </div>
                    <div className="p-7 space-y-5">
                        <div><label className={labelCls}>Program Name *</label><input value={form.name} onChange={f('name')} placeholder="e.g. PDLD, Infrastructure Review" className={inputCls} /></div>
                        <div><label className={labelCls}>Description</label><textarea value={form.description} onChange={f('description')} rows={2} className={inputCls + ' resize-none'} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={labelCls}>Target</label><input value={form.target_value} onChange={f('target_value')} placeholder="e.g. 100%" className={inputCls} /></div>
                            <div><label className={labelCls}>Achieved</label><input value={form.achieved_value} onChange={f('achieved_value')} placeholder="e.g. 45%" className={inputCls} /></div>
                        </div>
                        <div><label className={labelCls}>Review Frequency (days)</label><input type="number" value={form.review_frequency_days} onChange={f('review_frequency_days')} className={inputCls} /></div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={onClose} className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
                            <button onClick={() => form.name && onSave(form)} className="flex-1 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors">Save</button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Schedule Review Modal ──────────────────────────────────────────────────────
const ScheduleReviewModal = ({ isOpen, onClose, onSave, programId }) => {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);
    useEffect(() => { setDate(today); }, [isOpen]);
    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl w-full max-w-sm shadow-premium-lg p-7">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-black dark:text-white">Schedule Review</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} className="text-slate-400" /></button>
                    </div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Review Date *</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm mb-5" />
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
                        <button onClick={() => date && onSave({ program_id: programId, scheduled_date: date })}
                            className="flex-1 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors">Schedule</button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Debt Badge ─────────────────────────────────────────────────────────────────
const DebtBadge = ({ status }) => {
    const map = {
        ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
        overdue: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
        never_reviewed: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
    };
    const labels = { ok: 'On Track', warning: 'Due Soon', overdue: 'Overdue', never_reviewed: 'Never Reviewed' };
    return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${map[status] || map.ok}`}>{labels[status] || status}</span>;
};

// ── Inline Data Grid (Spreadsheet-style) ──────────────────────────────────────
const InlineDataGrid = ({ deptId }) => {
    const toast = useToast();
    const [grid, setGrid] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [localCols, setLocalCols] = useState([]);
    const [localRows, setLocalRows] = useState([]);
    const [saving, setSaving] = useState(false);
    const [editingColIdx, setEditingColIdx] = useState(null);
    const [editingColText, setEditingColText] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!deptId) return;
        api.getDataGrid(deptId).then(g => {
            setGrid(g);
            setLocalCols(g.columns || []);
            setLocalRows(g.rows || []);
        }).catch(() => {});
    }, [deptId]);

    const enterEdit = () => {
        setLocalCols(grid?.columns || []);
        setLocalRows(grid?.rows || []);
        setEditMode(true);
    };

    const saveGrid = async () => {
        setSaving(true);
        try {
            const updated = await api.updateDataGrid(deptId, { columns: localCols, rows: localRows });
            setGrid(updated);
            setEditMode(false);
            toast.success('Data saved');
        } catch { toast.error('Failed to save data'); }
        finally { setSaving(false); }
    };

    const cancelEdit = () => {
        setLocalCols(grid?.columns || []);
        setLocalRows(grid?.rows || []);
        setEditMode(false);
    };

    const updateCell = (rIdx, cIdx, val) => {
        setLocalRows(prev => {
            const next = prev.map(r => [...r]);
            while (next[rIdx].length < localCols.length) next[rIdx].push('');
            next[rIdx][cIdx] = val;
            return next;
        });
    };

    const addRow = () => setLocalRows(prev => [...prev, Array(localCols.length).fill('')]);

    const removeRow = (i) => setLocalRows(prev => prev.filter((_, idx) => idx !== i));

    const addCol = () => {
        const name = `Col ${localCols.length + 1}`;
        setLocalCols(prev => [...prev, name]);
        setLocalRows(prev => prev.map(r => [...r, '']));
    };

    const removeCol = (cIdx) => {
        if (localCols.length <= 1) return;
        setLocalCols(prev => prev.filter((_, i) => i !== cIdx));
        setLocalRows(prev => prev.map(r => r.filter((_, i) => i !== cIdx)));
    };

    const renameCol = (cIdx, val) => {
        setLocalCols(prev => prev.map((c, i) => i === cIdx ? val : c));
    };

    // Excel/CSV import
    const handleFileImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'csv') {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length === 0) return;
                const parsedRows = lines.map(line =>
                    line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim())
                );
                const headers = parsedRows[0];
                const dataRows = parsedRows.slice(1);
                setLocalCols(headers);
                setLocalRows(dataRows);
                toast.success(`Imported ${dataRows.length} rows from CSV`);
            };
            reader.readAsText(file);
        } else {
            // For xlsx we'd need SheetJS but since this is backend, fallback to message
            toast.error('For Excel files, please export as CSV first and re-import');
        }
        e.target.value = '';
    };

    const exportCSV = () => {
        const cols = editMode ? localCols : (grid?.columns || []);
        const rows = editMode ? localRows : (grid?.rows || []);
        const csv = [cols, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `data-grid.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const displayCols = editMode ? localCols : (grid?.columns || []);
    const displayRows = editMode ? localRows : (grid?.rows || []);

    if (!grid) return <div className="p-6 text-slate-400 text-sm">Loading grid…</div>;

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-white/10 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <Table2 size={18} className="text-teal-500" />
                    <span className="font-black text-slate-700 dark:text-white text-base">Data Grid</span>
                    <span className="text-xs text-slate-400">{displayRows.length} rows × {displayCols.length} cols</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                        <Download size={13} /> Export
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                        <Upload size={13} /> Import CSV
                    </button>
                    <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileImport} className="hidden" />
                    {editMode ? (
                        <>
                            <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-white/15 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
                            <button onClick={saveGrid} disabled={saving} className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-60">
                                <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                            </button>
                        </>
                    ) : (
                        <button onClick={enterEdit} className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                            <Edit2 size={13} /> Edit
                        </button>
                    )}
                </div>
            </div>

            {/* Grid table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                        <tr>
                            <th className="w-8 px-2 py-2 text-xs text-slate-400 font-black border-b border-r border-slate-100 dark:border-white/10">#</th>
                            {displayCols.map((col, cIdx) => (
                                <th key={cIdx} className="px-2 py-2 border-b border-r border-slate-100 dark:border-white/10 text-left font-black text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider min-w-[100px]">
                                    {editMode ? (
                                        <div className="flex items-center gap-1">
                                            {editingColIdx === cIdx ? (
                                                <input autoFocus value={editingColText}
                                                    onChange={e => setEditingColText(e.target.value)}
                                                    onBlur={() => { renameCol(cIdx, editingColText || col); setEditingColIdx(null); }}
                                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { renameCol(cIdx, editingColText || col); setEditingColIdx(null); } }}
                                                    className="w-full text-xs font-bold bg-white dark:bg-slate-700 border border-indigo-300 rounded px-1 py-0.5 focus:outline-none" />
                                            ) : (
                                                <span className="flex-1 cursor-pointer hover:text-indigo-600" onClick={() => { setEditingColIdx(cIdx); setEditingColText(col); }}>{col}</span>
                                            )}
                                            {localCols.length > 1 && (
                                                <button onClick={() => removeCol(cIdx)} className="p-0.5 text-rose-400 hover:bg-rose-50 rounded opacity-0 group-hover:opacity-100"><Minus size={10} /></button>
                                            )}
                                        </div>
                                    ) : col}
                                </th>
                            ))}
                            {editMode && (
                                <th className="px-2 py-2 border-b border-slate-100 dark:border-white/10">
                                    <button onClick={addCol} className="flex items-center gap-1 text-xs text-indigo-500 font-bold hover:text-indigo-700 whitespace-nowrap">
                                        <Plus size={11} /> Col
                                    </button>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.length === 0 && !editMode && (
                            <tr><td colSpan={displayCols.length + 1} className="text-center py-10 text-slate-400 italic text-xs">
                                No data yet. Click Edit to add rows.
                            </td></tr>
                        )}
                        {displayRows.map((row, rIdx) => (
                            <tr key={rIdx} className="group hover:bg-slate-50/60 dark:hover:bg-white/3 transition-colors">
                                <td className="px-2 py-1.5 text-xs text-slate-400 font-bold text-center border-r border-b border-slate-100 dark:border-white/5 w-8">
                                    {editMode ? (
                                        <button onClick={() => removeRow(rIdx)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Minus size={12} />
                                        </button>
                                    ) : rIdx + 1}
                                </td>
                                {displayCols.map((_, cIdx) => (
                                    <td key={cIdx} className="px-2 py-1 border-r border-b border-slate-100 dark:border-white/5 min-w-[100px]">
                                        {editMode ? (
                                            <input
                                                value={row[cIdx] || ''}
                                                onChange={e => updateCell(rIdx, cIdx, e.target.value)}
                                                className="w-full text-xs bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none px-1 py-0.5 text-slate-700 dark:text-slate-200 focus:bg-indigo-50/30 dark:focus:bg-indigo-900/20 rounded transition-colors"
                                                placeholder="—"
                                            />
                                        ) : (
                                            <span className="text-xs text-slate-700 dark:text-slate-300 px-1">{row[cIdx] || <span className="text-slate-300 dark:text-white/20">—</span>}</span>
                                        )}
                                    </td>
                                ))}
                                {editMode && <td className="border-b border-slate-100 dark:border-white/5" />}
                            </tr>
                        ))}
                        {editMode && (
                            <tr>
                                <td colSpan={displayCols.length + 2} className="px-4 py-2">
                                    <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-indigo-500 font-bold hover:text-indigo-700 transition-colors">
                                        <PlusCircle size={14} /> Add Row
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ── Inline Agenda Table ────────────────────────────────────────────────────────
// Replaces the old list UI with a proper inline-editable table
const AgendaTable = ({ deptId, agenda, setAgenda, onAddAgenda }) => {
    const toast = useToast();
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({ title: '', details: '' });
    const [addingNew, setAddingNew] = useState(false);
    const [newRow, setNewRow] = useState({ title: '', details: '' });
    const [saving, setSaving] = useState(false);

    const startEdit = (ap) => {
        setEditingId(ap.id);
        setEditValues({ title: ap.title, details: ap.details || '' });
    };

    const saveEdit = async (ap) => {
        if (!editValues.title.trim()) return;
        try {
            await api.updateAgendaPoint(deptId, ap.id, { title: editValues.title.trim(), details: editValues.details.trim() });
            setAgenda(prev => prev.map(a => a.id === ap.id ? { ...a, title: editValues.title.trim(), details: editValues.details.trim() } : a));
            setEditingId(null);
        } catch { toast.error('Failed to update'); }
    };

    const cancelEdit = () => setEditingId(null);

    const toggleStatus = async (ap) => {
        const next = ap.status === 'Open' ? 'Done' : ap.status === 'Done' ? 'Deferred' : 'Open';
        try {
            await api.updateAgendaPoint(deptId, ap.id, { status: next });
            setAgenda(prev => prev.map(a => a.id === ap.id ? { ...a, status: next } : a));
        } catch { toast.error('Failed to update status'); }
    };

    const deleteAp = async (apId) => {
        if (!window.confirm('Remove this agenda point?')) return;
        try {
            await api.deleteAgendaPoint(deptId, apId);
            setAgenda(prev => prev.filter(a => a.id !== apId));
            toast.success('Removed');
        } catch { toast.error('Failed to remove'); }
    };

    const saveNewRow = async () => {
        if (!newRow.title.trim()) return;
        setSaving(true);
        try {
            const created = await api.createAgendaPoint(deptId, { title: newRow.title.trim(), details: newRow.details.trim(), order_index: agenda.length });
            setAgenda(prev => [...prev, created]);
            setNewRow({ title: '', details: '' });
            setAddingNew(false);
        } catch { toast.error('Failed to add'); }
        finally { setSaving(false); }
    };

    const openCount = agenda.filter(a => a.status === 'Open').length;

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <ListChecks size={20} className="text-indigo-500" />
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">Agenda / To Do</h2>
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-black px-2 py-0.5 rounded-full">{openCount} open</span>
                </div>
                <button onClick={() => setAddingNew(true)}
                    className="flex items-center gap-1 p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 transition-colors">
                    <Plus size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 z-10">
                        <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400 w-8">#</th>
                            <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400">Agenda Item</th>
                            <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400 hidden sm:table-cell">Details</th>
                            <th className="px-3 py-2.5 text-center text-xs font-black uppercase tracking-wider text-slate-400 w-20">Status</th>
                            <th className="px-2 py-2.5 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {agenda.length === 0 && !addingNew && (
                            <tr><td colSpan={5} className="text-center py-10 text-slate-400 italic text-xs">
                                No agenda points yet. Click + to add one.
                            </td></tr>
                        )}
                        {agenda.map((ap, i) => (
                            <tr key={ap.id} className="group hover:bg-slate-50/60 dark:hover:bg-white/3 transition-colors">
                                <td className="px-4 py-2 text-xs text-slate-400 font-bold">{i + 1}</td>
                                <td className="px-3 py-2">
                                    {editingId === ap.id ? (
                                        <input autoFocus value={editValues.title}
                                            onChange={e => setEditValues(p => ({ ...p, title: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(ap); if (e.key === 'Escape') cancelEdit(); }}
                                            className="w-full text-sm px-2 py-1 border border-indigo-300 bg-white dark:bg-slate-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                                    ) : (
                                        <span className={`text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:text-indigo-600 ${ap.status === 'Done' ? 'line-through opacity-50' : ''}`}
                                            onClick={() => startEdit(ap)}>{ap.title}</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 hidden sm:table-cell">
                                    {editingId === ap.id ? (
                                        <input value={editValues.details}
                                            onChange={e => setEditValues(p => ({ ...p, details: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(ap); if (e.key === 'Escape') cancelEdit(); }}
                                            placeholder="Details (optional)"
                                            className="w-full text-xs px-2 py-1 border border-indigo-200 bg-white dark:bg-slate-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                                    ) : (
                                        <span className="text-xs text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => startEdit(ap)}>{ap.details || <span className="text-slate-200 dark:text-white/20">—</span>}</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    {editingId === ap.id ? (
                                        <div className="flex gap-1 justify-center">
                                            <button onClick={() => saveEdit(ap)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={13} /></button>
                                            <button onClick={cancelEdit} className="p-1 text-slate-400 hover:bg-slate-50 rounded"><X size={13} /></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => toggleStatus(ap)} title="Click to cycle status">
                                            <AgendaBadge status={ap.status} />
                                        </button>
                                    )}
                                </td>
                                <td className="px-2 py-2">
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                        <button onClick={() => startEdit(ap)} className="p-1 text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"><Edit2 size={12} /></button>
                                        <button onClick={() => deleteAp(ap.id)} className="p-1 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded"><Trash2 size={12} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {addingNew && (
                            <tr className="bg-indigo-50/40 dark:bg-indigo-900/10">
                                <td className="px-4 py-2 text-xs text-slate-400 font-bold">{agenda.length + 1}</td>
                                <td className="px-3 py-2">
                                    <input autoFocus value={newRow.title} onChange={e => setNewRow(p => ({ ...p, title: e.target.value }))}
                                        placeholder="Agenda point title *"
                                        onKeyDown={e => { if (e.key === 'Enter') saveNewRow(); if (e.key === 'Escape') { setAddingNew(false); setNewRow({ title: '', details: '' }); } }}
                                        className="w-full text-sm px-2 py-1 border border-indigo-300 bg-white dark:bg-slate-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                                </td>
                                <td className="px-3 py-2 hidden sm:table-cell">
                                    <input value={newRow.details} onChange={e => setNewRow(p => ({ ...p, details: e.target.value }))}
                                        placeholder="Details (optional)"
                                        onKeyDown={e => { if (e.key === 'Enter') saveNewRow(); if (e.key === 'Escape') { setAddingNew(false); setNewRow({ title: '', details: '' }); } }}
                                        className="w-full text-xs px-2 py-1 border border-indigo-200 bg-white dark:bg-slate-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Open</span>
                                </td>
                                <td className="px-2 py-2">
                                    <div className="flex items-center gap-1 justify-end">
                                        <button onClick={saveNewRow} disabled={saving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={13} /></button>
                                        <button onClick={() => { setAddingNew(false); setNewRow({ title: '', details: '' }); }} className="p-1 text-slate-400 hover:bg-slate-50 rounded"><X size={13} /></button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
const DepartmentDetail = ({ user, onLogout }) => {
    const { deptId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
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
    const [selectedMeeting, setSelectedMeeting] = useState(null);

    // Active tab for bottom section (targets / data grid)
    const [activeTab, setActiveTab] = useState('targets'); // 'targets' | 'datagrid'

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

    // ── Meeting handlers ─────────────────────────────────────────────────────
    const handleScheduleMeeting = async (form) => {
        try {
            await api.createMeeting(deptIdInt, form);
            setMeetingModal(false);
            const fresh = await api.getMeetings(deptIdInt);
            setMeetings(fresh);
            toast.success('Meeting scheduled');
        } catch { toast.error('Failed to schedule meeting'); }
    };

    const handleDeleteMeeting = async (id) => {
        if (!window.confirm('Delete this meeting?')) return;
        try {
            await api.deleteMeeting(deptIdInt, id);
            setMeetings(prev => prev.filter(m => m.id !== id));
            setSelectedMeeting(null);
            toast.success('Meeting deleted');
        } catch { toast.error('Failed to delete meeting'); }
    };

    const handleMeetingStatusChange = async (id, status) => {
        try {
            await api.updateMeeting(deptIdInt, id, { status });
            setMeetings(prev => prev.map(m => m.id === id ? { ...m, status } : m));
            setSelectedMeeting(prev => prev && prev.id === id ? { ...prev, status } : prev);
            toast.success(`Meeting marked as ${status}`);
        } catch { toast.error('Failed to update meeting'); }
    };

    // ── Program handlers ─────────────────────────────────────────────────────
    const handleSaveProgram = async (form) => {
        try {
            if (editProg) { await api.updateProgram(editProg.id, form); toast.success('Program updated'); }
            else { await api.createProgram(form); toast.success('Review program created'); }
            setProgModal(false); setEditProg(null); load();
        } catch { toast.error('Error saving program'); }
    };

    const handleDeleteProgram = async (id) => {
        if (!window.confirm('Delete this program and all its sessions?')) return;
        try { await api.deleteProgram(id); toast.success('Program deleted'); load(); }
        catch { toast.error('Failed to delete program'); }
    };

    const handleScheduleReview = async (form) => {
        try {
            await api.createSession(form);
            setSchedReviewModal(false);
            toast.success('Review session scheduled!');
            load();
        } catch { toast.error('Error scheduling review'); }
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

    const statusColors = {
        Scheduled: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
        Done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
        Cancelled: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
    };

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

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── TOP LEFT: Agenda / To Do — inline table ────────────────── */}
                <div className="glass-card rounded-3xl overflow-hidden flex flex-col min-h-[400px]">
                    <AgendaTable deptId={deptIdInt} agenda={agenda} setAgenda={setAgenda} />
                </div>

                {/* ── TOP RIGHT: Targets (Programs) — inline table ─────────────── */}
                <div className="glass-card rounded-3xl overflow-hidden flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <BookOpen size={20} className="text-emerald-500" />
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">Review Programs</h2>
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
                                    <th className="px-4 py-3 font-black text-center whitespace-nowrap">Achieved</th>
                                    <th className="px-4 py-3 font-black text-center">Target</th>
                                    <th className="px-4 py-3 font-black text-center">Status</th>
                                    <th className="px-4 py-3 font-black text-center"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {dept.programs?.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-8 text-slate-400 italic text-xs">No programs defined</td></tr>
                                ) : (
                                    dept.programs?.map((prog, i) => (
                                        <tr key={prog.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group cursor-pointer">
                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white" onClick={() => { setEditProg(prog); setProgModal(true); }}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400 font-bold">{i + 1}.</span>
                                                    <div>
                                                        <p>{prog.name}</p>
                                                        {prog.description && <p className="text-xs text-slate-400 font-normal">{prog.description}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400" onClick={() => { setEditProg(prog); setProgModal(true); }}>
                                                {prog.achieved_value || <span className="text-slate-300 dark:text-white/20">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-300 border-l border-slate-100 dark:border-white/5" onClick={() => { setEditProg(prog); setProgModal(true); }}>
                                                {prog.target_value || <span className="text-slate-300 dark:text-white/20">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center" onClick={() => { setEditProg(prog); setProgModal(true); }}>
                                                <DebtBadge status={prog.debt_status} />
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); setSchedulingProgId(prog.id); setSchedReviewModal(true); }}
                                                        className="text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold whitespace-nowrap">
                                                        + Review
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProgram(prog.id); }}
                                                        className="p-1 text-rose-400 hover:bg-rose-50 rounded">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── BOTTOM LEFT: Department Meetings ─────────────────────── */}
                <div className="glass-card rounded-3xl overflow-hidden min-h-[300px] flex flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <Calendar size={20} className="text-violet-500" />
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">Meetings</h2>
                            <span className="text-xs bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 font-black px-2 py-0.5 rounded-full">{meetings.length}</span>
                        </div>
                        <button onClick={() => setMeetingModal(true)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors">
                            <Plus size={14} /> Schedule
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar">
                        {meetings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <Calendar size={32} className="mb-3 opacity-30" />
                                <p className="text-sm">No meetings scheduled yet</p>
                                <button onClick={() => setMeetingModal(true)} className="mt-3 text-xs text-violet-600 font-bold hover:underline">Schedule first meeting →</button>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 z-10">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400">#</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400">Date</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400 hidden sm:table-cell">Venue</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-black uppercase tracking-wider text-slate-400">Status</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400 hidden md:table-cell">Agenda items</th>
                                        <th className="px-2 py-2.5 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {meetings.map((m, i) => (
                                        <tr key={m.id} className="group hover:bg-slate-50/60 dark:hover:bg-white/3 transition-colors cursor-pointer"
                                            onClick={() => setSelectedMeeting(m)}>
                                            <td className="px-4 py-3 text-xs text-slate-400 font-bold">{i + 1}</td>
                                            <td className="px-3 py-3">
                                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                                    {format(new Date(m.scheduled_date), 'dd/MM/yyyy')}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 hidden sm:table-cell">
                                                <span className="text-xs text-slate-500">{m.venue || <span className="text-slate-300 dark:text-white/20">—</span>}</span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${statusColors[m.status] || statusColors.Scheduled}`}>
                                                    {m.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 hidden md:table-cell">
                                                <span className="text-xs text-slate-500">
                                                    {m.agenda_snapshot?.length ? `${m.agenda_snapshot.length} item${m.agenda_snapshot.length > 1 ? 's' : ''}` : <span className="text-slate-300 dark:text-white/20">—</span>}
                                                </span>
                                            </td>
                                            <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => handleDeleteMeeting(m.id)}
                                                    className="p-1 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ── BOTTOM RIGHT: Data Grid (tabbed with Last Meeting) ─────── */}
                <div className="glass-card rounded-3xl overflow-hidden min-h-[300px] flex flex-col">
                    {/* Tab headers */}
                    <div className="flex items-center border-b border-slate-100 dark:border-white/10">
                        <button
                            onClick={() => setActiveTab('datagrid')}
                            className={`flex items-center gap-2 px-5 py-4 text-sm font-black transition-colors border-b-2 ${activeTab === 'datagrid' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            <Table2 size={16} /> Data Grid
                        </button>
                        <button
                            onClick={() => setActiveTab('lastmeeting')}
                            className={`flex items-center gap-2 px-5 py-4 text-sm font-black transition-colors border-b-2 ${activeTab === 'lastmeeting' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            <FileText size={16} /> Last Review
                        </button>
                    </div>

                    {activeTab === 'datagrid' ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <InlineDataGrid deptId={deptIdInt} />
                        </div>
                    ) : (
                        <div className="p-5 flex-1 relative">
                            {sessions.length > 0 && sessions.filter(s => s.status === 'Completed').length > 0 ? (() => {
                                const lastMeeting = sessions.filter(s => s.status === 'Completed').sort((a, b) => new Date(b.actual_date || b.scheduled_date) - new Date(a.actual_date || a.scheduled_date))[0];
                                const noteLines = (lastMeeting.notes || "No notes recorded.").split('\n').filter(l => l.trim().length > 0);
                                return (
                                    <>
                                        <p className="text-xs font-black uppercase text-slate-400 mb-3">
                                            Last review: {format(new Date(lastMeeting.actual_date || lastMeeting.scheduled_date), 'd MMM yyyy')}
                                        </p>
                                        <div className="space-y-3 mb-16">
                                            {noteLines.slice(0, 3).map((line, idx) => (
                                                <div key={idx} className="flex items-start gap-2">
                                                    <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{line}</p>
                                                </div>
                                            ))}
                                            {noteLines.length === 0 && <p className="text-sm text-slate-400">No notes recorded.</p>}
                                        </div>
                                        <button
                                            onClick={() => navigate(`/reviews/${lastMeeting.id}`)}
                                            className="absolute bottom-5 right-5 px-6 py-2.5 rounded-full border-2 border-amber-400 text-amber-600 dark:text-amber-400 font-black hover:bg-amber-50 dark:hover:bg-amber-400/10 transition-colors">
                                            Details
                                        </button>
                                    </>
                                );
                            })() : (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <FileText size={32} className="mb-3 opacity-30" />
                                    <p className="text-sm">No completed reviews found</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <ProgramModal isOpen={progModal} onClose={() => { setProgModal(false); setEditProg(null); }}
                onSave={handleSaveProgram} departmentId={deptIdInt} initial={editProg} />
            <ScheduleReviewModal isOpen={schedReviewModal} onClose={() => setSchedReviewModal(false)}
                onSave={handleScheduleReview} programId={schedulingProgId} />
            <ScheduleMeetingModal isOpen={meetingModal} onClose={() => setMeetingModal(false)}
                onSave={handleScheduleMeeting} agenda={agenda} deptName={dept.name} />
            {selectedMeeting && (
                <MeetingDetailModal
                    meeting={selectedMeeting}
                    onClose={() => setSelectedMeeting(null)}
                    onDelete={handleDeleteMeeting}
                    onStatusChange={handleMeetingStatusChange}
                />
            )}
        </Layout>
    );
};

export default DepartmentDetail;
