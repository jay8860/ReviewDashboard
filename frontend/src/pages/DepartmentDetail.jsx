import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Trash2, Edit2, Calendar,
    X, RefreshCw, ListChecks, MapPin, Users, Check,
    Table2, Upload, Download,
    Save, PlusCircle, Minus, ChevronRight, Search
} from 'lucide-react';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import { format, parseISO } from 'date-fns';
import DocumentAnalysisPanel from '../components/DocumentAnalysisPanel';

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

const DEFAULT_MEETING_TABLE_COLUMNS = ["Action Point", "Owner", "Timeline", "Status", "Remarks"];

const parseDateSafe = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const text = String(value).trim();
    if (!text) return null;

    const parsedIso = parseISO(text);
    if (!Number.isNaN(parsedIso.getTime())) return parsedIso;

    const parsedNative = new Date(text);
    if (!Number.isNaN(parsedNative.getTime())) return parsedNative;
    return null;
};

const formatDateSafe = (value, fmt = 'd MMMM yyyy', fallback = 'TBD') => {
    const parsed = parseDateSafe(value);
    if (!parsed) return fallback;
    try {
        return format(parsed, fmt);
    } catch {
        return fallback;
    }
};

// WhatsApp SVG
const WAIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const getMeetingWhatsAppMessage = (meeting, deptName) => {
    const agendaSnapshot = Array.isArray(meeting?.agenda_snapshot) ? meeting.agenda_snapshot : [];
    const dateText = formatDateSafe(meeting?.scheduled_date, 'd MMMM yyyy', 'TBD');
    const timeText = meeting?.scheduled_time ? `\nTime: ${meeting.scheduled_time}` : '';
    const venueText = meeting?.venue ? `\nVenue: ${meeting.venue}` : '';
    const notesText = meeting?.notes ? `\n\nNotes:\n${meeting.notes}` : '';
    const agendaText = agendaSnapshot.length
        ? agendaSnapshot.map((a, idx) => `${idx + 1}. ${a?.title || ''}${a?.details ? ` — ${a.details}` : ''}`).join('\n')
        : 'No agenda points attached.';

    return `Meeting Agenda - ${deptName || 'Department'}\nDate: ${dateText}${timeText}${venueText}\n\nAgenda Points:\n${agendaText}${notesText}`;
};

const isStenoEmployee = (emp) => {
    const haystack = `${emp?.name || ''} ${emp?.display_username || ''}`.toLowerCase();
    return haystack.includes('steno') || haystack.includes('secretary');
};

// ── Schedule Meeting Modal ─────────────────────────────────────────────────────
const ScheduleMeetingModal = ({ isOpen, onClose, onSave, agenda = [], deptName = '' }) => {
    const today = new Date().toISOString().split('T')[0];
    const [form, setForm] = useState({ scheduled_date: today, scheduled_time: '10:00', venue: '', attendees: '', officer_phone: '', notes: '' });
    useEffect(() => { setForm({ scheduled_date: today, scheduled_time: '10:00', venue: '', attendees: '', officer_phone: '', notes: '' }); }, [isOpen]);

    if (!isOpen) return null;

    const openAgenda = agenda.filter(a => a.status === 'Open');

    const waMsg = `Meeting Agenda - ${deptName}\nDate: ${formatDateSafe(form.scheduled_date, 'd MMMM yyyy', 'TBD')}${form.scheduled_time ? `\nTime: ${form.scheduled_time}` : ''}${form.venue ? `\nVenue: ${form.venue}` : ''}\n\nAgenda Points:\n${openAgenda.map((a, i) => `${i + 1}. ${a.title}${a.details ? `\n   - ${a.details}` : ''}`).join('\n')}\n\nPlease ensure your presence and come prepared.`;

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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Date *</label>
                                <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Time *</label>
                                <input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
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

                        <div className="rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 p-3">
                            <p className="text-xs text-teal-700 dark:text-teal-300 font-semibold">
                                A meeting Action Table will be created automatically. Open the meeting row later to enter live action points.
                            </p>
                        </div>

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

const WhatsAppMeetingModal = ({ isOpen, onClose, meeting, deptName, employees = [] }) => {
    const toast = useToast();
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
    const [includeOfficer, setIncludeOfficer] = useState(true);
    const [includeStenoCopy, setIncludeStenoCopy] = useState(true);

    useEffect(() => {
        if (!isOpen || !meeting) return;
        setMessage(getMeetingWhatsAppMessage(meeting, deptName));
        setSearchTerm('');
        setSelectedEmployeeIds([]);
        setIncludeOfficer(Boolean(meeting.officer_phone));
        const hasSteno = employees.some(isStenoEmployee);
        setIncludeStenoCopy(hasSteno);
    }, [isOpen, meeting?.id, deptName, employees]);

    if (!isOpen || !meeting) return null;

    const visibleEmployees = employees.filter(emp => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            (emp.name || '').toLowerCase().includes(q) ||
            (emp.display_username || '').toLowerCase().includes(q) ||
            (emp.mobile_number || '').toLowerCase().includes(q)
        );
    });

    const stenoEmployees = employees.filter(isStenoEmployee);

    const toggleEmployee = (id) => {
        setSelectedEmployeeIds(prev => (
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        ));
    };

    const buildRecipientNumbers = () => {
        const numbers = [];
        const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
        selectedEmployeeIds.forEach(id => {
            const mobile = employeeMap.get(id)?.mobile_number;
            if (mobile) numbers.push(mobile);
        });
        if (includeOfficer && meeting.officer_phone) numbers.push(meeting.officer_phone);
        if (includeStenoCopy) {
            stenoEmployees.forEach(emp => {
                if (emp.mobile_number) numbers.push(emp.mobile_number);
            });
        }
        const normalized = numbers
            .map(value => String(value || '').replace(/\D/g, ''))
            .filter(Boolean);
        return [...new Set(normalized)];
    };

    const handleSend = () => {
        const finalMessage = (message || '').trim();
        if (!finalMessage) {
            toast.error('Message draft cannot be empty');
            return;
        }
        const recipients = buildRecipientNumbers();
        if (!recipients.length) {
            toast.error('Select at least one recipient or officer number');
            return;
        }
        const encoded = encodeURIComponent(finalMessage);
        recipients.forEach((number, idx) => {
            setTimeout(() => {
                window.open(`https://wa.me/${number}?text=${encoded}`, '_blank', 'noopener,noreferrer');
            }, idx * 250);
        });
        toast.success(`Opening WhatsApp for ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`);
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="glass-card rounded-3xl w-full max-w-3xl shadow-premium-lg max-h-[92vh] overflow-y-auto custom-scrollbar"
                >
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-500/5 dark:to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <WAIcon />
                            </div>
                            <div>
                                <h2 className="text-lg font-black dark:text-white">WhatsApp Draft</h2>
                                <p className="text-xs text-slate-400">{deptName} · {formatDateSafe(meeting.scheduled_date, 'd MMM yyyy', 'TBD')}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">
                            <X size={18} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Recipients</p>
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <Search size={14} className="text-slate-400" />
                                        <input
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            placeholder="Search employees..."
                                            className="w-full text-sm text-slate-700 bg-transparent focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                                    {visibleEmployees.length === 0 ? (
                                        <p className="px-3 py-3 text-xs text-slate-400 italic">No employees found.</p>
                                    ) : visibleEmployees.map(emp => (
                                        <label key={emp.id} className="px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-slate-50">
                                            <input
                                                type="checkbox"
                                                checked={selectedEmployeeIds.includes(emp.id)}
                                                onChange={() => toggleEmployee(emp.id)}
                                                className="w-4 h-4 accent-indigo-600"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-700 truncate">{emp.name}</p>
                                                <p className="text-[11px] text-slate-400 truncate">{emp.mobile_number} · {emp.display_username}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={includeOfficer}
                                        onChange={e => setIncludeOfficer(e.target.checked)}
                                        className="w-4 h-4 accent-indigo-600"
                                    />
                                    Include officer phone {meeting.officer_phone ? `(${meeting.officer_phone})` : '(not set)'}
                                </label>
                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={includeStenoCopy}
                                        onChange={e => setIncludeStenoCopy(e.target.checked)}
                                        className="w-4 h-4 accent-indigo-600"
                                        disabled={stenoEmployees.length === 0}
                                    />
                                    Send copy to steno {stenoEmployees.length ? `(${stenoEmployees.length})` : '(not found)'}
                                </label>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Message Draft (Editable)</p>
                                <textarea
                                    rows={16}
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    className="w-full text-sm px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 inline-flex items-center gap-2"
                            >
                                <WAIcon /> Send WhatsApp
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// ── Meeting Detail Modal (with action table editing) ──────────────────────────
const MeetingDetailModal = ({ meeting, onClose, onDelete, onStatusChange, onSaveTable }) => {
    const [activeTab, setActiveTab] = useState('details');
    const [editMode, setEditMode] = useState(false);
    const [columns, setColumns] = useState(DEFAULT_MEETING_TABLE_COLUMNS);
    const [rows, setRows] = useState([]);
    const [savingTable, setSavingTable] = useState(false);
    const [editingColIdx, setEditingColIdx] = useState(null);
    const [editingColText, setEditingColText] = useState('');

    useEffect(() => {
        if (!meeting) return;
        setActiveTab('details');
        setEditMode(false);
        setColumns(meeting.action_table_columns?.length ? meeting.action_table_columns : DEFAULT_MEETING_TABLE_COLUMNS);
        setRows(meeting.action_table_rows || []);
        setEditingColIdx(null);
        setEditingColText('');
    }, [meeting?.id]);

    if (!meeting) return null;

    const statusColors = {
        Scheduled: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
        Done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
        Cancelled: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
    };

    const updateCell = (rIdx, cIdx, val) => {
        setRows(prev => {
            const next = prev.map(r => [...r]);
            while (next[rIdx].length < columns.length) next[rIdx].push('');
            next[rIdx][cIdx] = val;
            return next;
        });
    };

    const addRow = () => setRows(prev => [...prev, Array(columns.length).fill('')]);
    const removeRow = (rIdx) => setRows(prev => prev.filter((_, i) => i !== rIdx));

    const addCol = () => {
        const name = `Col ${columns.length + 1}`;
        setColumns(prev => [...prev, name]);
        setRows(prev => prev.map(r => [...r, '']));
    };

    const removeCol = (cIdx) => {
        if (columns.length <= 1) return;
        setColumns(prev => prev.filter((_, i) => i !== cIdx));
        setRows(prev => prev.map(r => r.filter((_, i) => i !== cIdx)));
    };

    const renameCol = (cIdx, val) => {
        setColumns(prev => prev.map((c, i) => (i === cIdx ? val : c)));
    };

    const handleSaveTable = async () => {
        setSavingTable(true);
        try {
            await onSaveTable(meeting.id, {
                action_table_columns: columns,
                action_table_rows: rows,
            });
            setEditMode(false);
        } finally {
            setSavingTable(false);
        }
    };

    const cancelEdit = () => {
        setEditMode(false);
        setColumns(meeting.action_table_columns?.length ? meeting.action_table_columns : DEFAULT_MEETING_TABLE_COLUMNS);
        setRows(meeting.action_table_rows || []);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="glass-card rounded-3xl w-full max-w-5xl shadow-premium-lg max-h-[92vh] overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black dark:text-white">Meeting Details</h2>
                            <p className="text-xs text-slate-400">{formatDateSafe(meeting.scheduled_date, 'd MMMM yyyy', 'TBD')}</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} className="text-slate-400" /></button>
                    </div>

                    <div className="border-b border-slate-100 dark:border-white/10 flex items-center">
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`px-5 py-3 text-sm font-black border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            Details
                        </button>
                        <button
                            onClick={() => setActiveTab('table')}
                            className={`px-5 py-3 text-sm font-black border-b-2 transition-colors ${activeTab === 'table' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            Action Table
                        </button>
                    </div>

                    {activeTab === 'details' ? (
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
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
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Table2 size={16} className="text-teal-500" />
                                    <span className="text-sm font-black text-slate-700 dark:text-white">Meeting Action Table</span>
                                    <span className="text-xs text-slate-400">{rows.length} rows × {columns.length} cols</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {editMode ? (
                                        <>
                                            <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-white/15 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
                                            <button onClick={handleSaveTable} disabled={savingTable}
                                                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-60">
                                                <Save size={13} /> {savingTable ? 'Saving…' : 'Save'}
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => setEditMode(true)} className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                                            <Edit2 size={13} /> Edit
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                                        <tr>
                                            <th className="w-8 px-2 py-2 text-xs text-slate-400 font-black border-b border-r border-slate-100 dark:border-white/10">#</th>
                                            {columns.map((col, cIdx) => (
                                                <th key={cIdx} className="px-2 py-2 border-b border-r border-slate-100 dark:border-white/10 text-left font-black text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider min-w-[130px]">
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
                                                            {columns.length > 1 && (
                                                                <button onClick={() => removeCol(cIdx)} className="p-0.5 text-rose-400 hover:bg-rose-50 rounded"><Minus size={10} /></button>
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
                                        {rows.length === 0 && !editMode && (
                                            <tr><td colSpan={columns.length + 1} className="text-center py-10 text-slate-400 italic text-xs">
                                                No action entries yet. Click Edit to add rows.
                                            </td></tr>
                                        )}
                                        {rows.map((row, rIdx) => (
                                            <tr key={rIdx} className="group hover:bg-slate-50/60 dark:hover:bg-white/3 transition-colors">
                                                <td className="px-2 py-1.5 text-xs text-slate-400 font-bold text-center border-r border-b border-slate-100 dark:border-white/5 w-8">
                                                    {editMode ? (
                                                        <button onClick={() => removeRow(rIdx)} className="text-rose-400 hover:text-rose-600">
                                                            <Minus size={12} />
                                                        </button>
                                                    ) : rIdx + 1}
                                                </td>
                                                {columns.map((_, cIdx) => (
                                                    <td key={cIdx} className="px-2 py-1 border-r border-b border-slate-100 dark:border-white/5 min-w-[130px]">
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
                                                <td colSpan={columns.length + 2} className="px-4 py-2">
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
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
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
                                                <button onClick={() => removeCol(cIdx)} className="p-0.5 text-rose-400 hover:bg-rose-50 rounded"><Minus size={10} /></button>
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
                                        <button onClick={() => removeRow(rIdx)} className="text-rose-400 hover:text-rose-600">
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
const AgendaTable = ({ deptId, agenda, setAgenda }) => {
    const toast = useToast();
    const [editMode, setEditMode] = useState(false);
    const [localRows, setLocalRows] = useState([]);
    const [addingNew, setAddingNew] = useState(false);
    const [newRow, setNewRow] = useState({ title: '', details: '' });
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        if (!editMode) return;
        setLocalRows(agenda.map(item => ({
            id: item.id,
            title: item.title || '',
            details: item.details || '',
            status: item.status || 'Open',
        })));
        setSelectedIds([]);
    }, [editMode, agenda]);

    useEffect(() => {
        const validIds = new Set(localRows.map(r => r.id));
        setSelectedIds(prev => prev.filter(id => validIds.has(id)));
    }, [localRows]);

    const selectedCount = selectedIds.length;
    const allSelected = editMode && localRows.length > 0 && selectedCount === localRows.length;

    const clearSelection = () => setSelectedIds([]);
    const isSelected = (id) => selectedIds.includes(id);
    const toggleSelectOne = (id) => {
        setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    };
    const toggleSelectAll = () => {
        if (allSelected) {
            clearSelection();
            return;
        }
        setSelectedIds(localRows.map(r => r.id));
    };

    const updateLocalRow = (id, key, value) => {
        setLocalRows(prev => prev.map(item => (item.id === id ? { ...item, [key]: value } : item)));
    };

    const enterEdit = () => {
        setEditMode(true);
        setAddingNew(false);
    };

    const cancelEdit = () => {
        setEditMode(false);
        setLocalRows([]);
        setSelectedIds([]);
        setAddingNew(false);
    };

    const saveAll = async () => {
        if (!editMode) return;
        const payloadItems = localRows.map(item => ({
            id: item.id,
            title: (item.title || '').trim(),
            details: (item.details || '').trim(),
            status: item.status || 'Open',
        }));

        if (payloadItems.some(item => !item.title)) {
            toast.error('Title cannot be empty');
            return;
        }

        setSaving(true);
        try {
            const updated = await api.bulkUpdateAgendaPoints(deptId, { items: payloadItems });
            const updatedById = new Map(updated.map(item => [item.id, item]));
            setAgenda(prev => prev.map(item => (updatedById.has(item.id) ? { ...item, ...updatedById.get(item.id) } : item)));
            setEditMode(false);
            setLocalRows([]);
            setSelectedIds([]);
            toast.success(`Saved ${updated.length} agenda item${updated.length > 1 ? 's' : ''}`);
        } catch {
            toast.error('Failed to save agenda');
        } finally {
            setSaving(false);
        }
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

    const deleteSelected = async () => {
        if (!editMode || !selectedCount) return;
        const idsToDelete = [...selectedIds];
        if (!window.confirm(`Delete ${idsToDelete.length} selected agenda item${idsToDelete.length > 1 ? 's' : ''}?`)) return;
        setSaving(true);
        try {
            await api.bulkDeleteAgendaPoints(deptId, { ids: idsToDelete });
            setAgenda(prev => prev.filter(item => !idsToDelete.includes(item.id)));
            setLocalRows(prev => prev.filter(item => !idsToDelete.includes(item.id)));
            clearSelection();
            toast.success(`Deleted ${idsToDelete.length} agenda item${idsToDelete.length > 1 ? 's' : ''}`);
        } catch {
            toast.error('Failed to delete selected agenda items');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <ListChecks size={20} className="text-indigo-500" />
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">Agenda / To Do</h2>
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-black px-2 py-0.5 rounded-full">{openCount} open</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAddingNew(true)}
                        className="flex items-center gap-1 p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 transition-colors"
                        title="Add agenda item"
                    >
                        <Plus size={16} />
                    </button>
                    {editMode ? (
                        <>
                            <button
                                onClick={deleteSelected}
                                disabled={!selectedCount || saving}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-60 transition-colors"
                            >
                                Delete Selected
                            </button>
                            <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-white/15 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-60 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveAll}
                                disabled={saving}
                                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
                            >
                                <Save size={13} /> {saving ? 'Saving…' : 'Save All'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={enterEdit}
                            className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                        >
                            <Edit2 size={13} /> Edit
                        </button>
                    )}
                </div>
            </div>

            {editMode && selectedCount > 0 && (
                <div className="px-5 py-2.5 border-b border-indigo-100/80 dark:border-indigo-500/20 bg-indigo-50/70 dark:bg-indigo-500/10">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">{selectedCount} selected for delete</span>
                        <button onClick={deleteSelected} disabled={saving} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors disabled:opacity-60">Delete Selected</button>
                        <button onClick={clearSelection} disabled={saving} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60">Clear</button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 z-10">
                        <tr>
                            {editMode && (
                                <th className="px-3 py-2.5 text-center w-10">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                        aria-label="Select all agenda items"
                                    />
                                </th>
                            )}
                            <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400 w-8">#</th>
                            <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400">Agenda Item</th>
                            <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-slate-400 hidden sm:table-cell">Details</th>
                            <th className="px-2 py-2.5 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {agenda.length === 0 && !addingNew && (
                            <tr><td colSpan={editMode ? 5 : 4} className="text-center py-10 text-slate-400 italic text-xs">
                                No agenda points yet. Click + to add one.
                            </td></tr>
                        )}
                        {(editMode ? localRows : agenda).map((ap, i) => (
                            <tr key={ap.id} className="group hover:bg-slate-50/60 dark:hover:bg-white/3 transition-colors">
                                {editMode && (
                                    <td className="px-3 py-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={isSelected(ap.id)}
                                            onChange={() => toggleSelectOne(ap.id)}
                                            className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                            aria-label={`Select agenda item ${ap.title}`}
                                        />
                                    </td>
                                )}
                                <td className="px-4 py-2 text-xs text-slate-400 font-bold">{i + 1}</td>
                                <td className="px-3 py-2">
                                    {editMode ? (
                                        <input
                                            value={ap.title}
                                            onChange={e => updateLocalRow(ap.id, 'title', e.target.value)}
                                            className="w-full text-sm px-2 py-1 border border-indigo-300 bg-white dark:bg-slate-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />
                                    ) : (
                                        <span className={`text-sm font-semibold text-slate-700 dark:text-slate-200 ${ap.status === 'Done' ? 'line-through opacity-50' : ''}`}>
                                            {ap.title}
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 hidden sm:table-cell">
                                    {editMode ? (
                                        <input
                                            value={ap.details || ''}
                                            onChange={e => updateLocalRow(ap.id, 'details', e.target.value)}
                                            placeholder="Details (optional)"
                                            className="w-full text-xs px-2 py-1 border border-indigo-200 bg-white dark:bg-slate-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />
                                    ) : (
                                        <span className="text-xs text-slate-400">
                                            {ap.details || <span className="text-slate-200 dark:text-white/20">—</span>}
                                        </span>
                                    )}
                                </td>
                                <td className="px-2 py-2" />
                            </tr>
                        ))}
                        {addingNew && (
                            <tr className="bg-indigo-50/40 dark:bg-indigo-900/10">
                                {editMode && <td className="px-3 py-2" />}
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
    const deptIdInt = parseInt(deptId, 10);

    const [dept, setDept] = useState(null);
    const [agenda, setAgenda] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    const [meetingModal, setMeetingModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [waMeeting, setWaMeeting] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [deptData, agendaData, meetingsData, employeesData] = await Promise.all([
                api.getDepartment(deptIdInt),
                api.getAgendaPoints(deptIdInt),
                api.getMeetings(deptIdInt),
                api.getEmployees({}),
            ]);
            setDept(deptData);
            setAgenda(agendaData);
            setMeetings(meetingsData);
            setEmployees((employeesData || []).filter(emp => emp.is_active !== false));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [deptId]);

    const refreshMeetingsOnly = async () => {
        const fresh = await api.getMeetings(deptIdInt);
        setMeetings(fresh);
        return fresh;
    };

    const handleScheduleMeeting = async (form) => {
        try {
            await api.createMeeting(deptIdInt, form);
            setMeetingModal(false);
            await refreshMeetingsOnly();
            toast.success('Meeting scheduled');
        } catch {
            toast.error('Failed to schedule meeting');
        }
    };

    const handleDeleteMeeting = async (id) => {
        if (!window.confirm('Delete this meeting?')) return;
        try {
            await api.deleteMeeting(deptIdInt, id);
            setMeetings(prev => prev.filter(m => m.id !== id));
            setSelectedMeeting(null);
            toast.success('Meeting deleted');
        } catch {
            toast.error('Failed to delete meeting');
        }
    };

    const handleMeetingStatusChange = async (id, status) => {
        try {
            await api.updateMeeting(deptIdInt, id, { status });
            const fresh = await refreshMeetingsOnly();
            const updated = fresh.find(m => m.id === id) || null;
            setSelectedMeeting(updated);
            toast.success(`Meeting marked as ${status}`);
        } catch {
            toast.error('Failed to update meeting');
        }
    };

    const handleMeetingTableSave = async (id, payload) => {
        try {
            await api.updateMeeting(deptIdInt, id, payload);
            const fresh = await refreshMeetingsOnly();
            const updated = fresh.find(m => m.id === id) || null;
            setSelectedMeeting(updated);
            toast.success('Meeting action table saved');
        } catch {
            toast.error('Failed to save meeting action table');
            throw new Error('save failed');
        }
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
        Cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400',
    };

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/departments')}
                    className="p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-400 transition-colors">
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

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                <div className="glass-card rounded-3xl overflow-hidden flex flex-col min-h-[360px]">
                    <AgendaTable deptId={deptIdInt} agenda={agenda} setAgenda={setAgenda} />
                </div>

                <div className="glass-card rounded-3xl overflow-hidden min-h-[360px] flex flex-col border border-indigo-100/60 dark:border-indigo-500/20">
                    <div className="px-5 py-4 border-b border-indigo-100/70 dark:border-indigo-500/20 bg-gradient-to-r from-indigo-50/80 via-violet-50/60 to-white dark:from-indigo-500/15 dark:via-violet-500/10 dark:to-transparent">
                        <div className="flex items-center gap-2">
                            <Table2 size={18} className="text-violet-600" />
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">Data Grid</h2>
                            <span className="text-xs bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-full">Top Right</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Department-level tracker sheet</p>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <InlineDataGrid deptId={deptIdInt} />
                    </div>
                </div>

                <div className="glass-card rounded-3xl overflow-hidden min-h-[320px] flex flex-col xl:col-span-2">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-indigo-100/70 dark:border-indigo-500/20 bg-gradient-to-r from-violet-50/70 to-white dark:from-violet-500/10 dark:to-transparent">
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

                    <div className="px-5 py-2 border-b border-indigo-50 dark:border-indigo-500/15">
                        <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-300">
                            Click any meeting to open the Meeting Workspace and capture MOM + action points.
                        </p>
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
                                <thead className="sticky top-0 bg-violet-50/80 dark:bg-violet-500/10 z-10">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider text-violet-500">#</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-violet-500">Date</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-violet-500 hidden sm:table-cell">Venue</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-black uppercase tracking-wider text-violet-500">Status</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-black uppercase tracking-wider text-violet-500 hidden md:table-cell">Entries</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-black uppercase tracking-wider text-violet-500">Notify</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-black uppercase tracking-wider text-violet-500">Open</th>
                                        <th className="px-2 py-2.5 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-indigo-50 dark:divide-indigo-500/10">
                                    {meetings.map((m, i) => (
                                        <tr
                                            key={m.id}
                                            className="group hover:bg-violet-50/40 dark:hover:bg-violet-500/8 transition-colors cursor-pointer"
                                            onClick={() => navigate(`/departments/${deptIdInt}/meetings/${m.id}`)}
                                        >
                                            <td className="px-4 py-3 text-xs text-slate-400 font-bold">{i + 1}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                                        {format(new Date(m.scheduled_date), 'dd/MM/yyyy')}
                                                    </span>
                                                    {m.scheduled_time && (
                                                        <span className="text-[11px] text-slate-400">{m.scheduled_time}</span>
                                                    )}
                                                </div>
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
                                                    {m.action_table_rows?.length ? `${m.action_table_rows.length} row${m.action_table_rows.length > 1 ? 's' : ''}` : <span className="text-slate-300 dark:text-white/20">—</span>}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setWaMeeting(m)}
                                                    className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-[11px] font-black transition-colors"
                                                    title="Preview and send WhatsApp meeting message"
                                                >
                                                    <WAIcon />
                                                    WA
                                                </button>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-600">
                                                    Workspace <ChevronRight size={12} />
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

                <div className="xl:col-span-2">
                    <DocumentAnalysisPanel
                        deptId={deptIdInt}
                        title="Department Documents & AI Analysis"
                    />
                </div>
            </div>

            <ScheduleMeetingModal
                isOpen={meetingModal}
                onClose={() => setMeetingModal(false)}
                onSave={handleScheduleMeeting}
                agenda={agenda}
                deptName={dept.name}
            />
            <WhatsAppMeetingModal
                isOpen={Boolean(waMeeting)}
                onClose={() => setWaMeeting(null)}
                meeting={waMeeting}
                deptName={dept.name}
                employees={employees}
            />
            {selectedMeeting && (
                <MeetingDetailModal
                    meeting={selectedMeeting}
                    onClose={() => setSelectedMeeting(null)}
                    onDelete={handleDeleteMeeting}
                    onStatusChange={handleMeetingStatusChange}
                    onSaveTable={handleMeetingTableSave}
                />
            )}
        </Layout>
    );
};

export default DepartmentDetail;
