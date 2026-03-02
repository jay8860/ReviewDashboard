import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Edit2, Trash2, CheckCircle2, Flag, Pin, Calendar, CalendarClock,
    MessageSquare, X, Save, ChevronUp, ChevronDown, ChevronsUpDown
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

// WhatsApp SVG icon
const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// ── Due In Badge ───────────────────────────────────────────────────────────────
const DueInBadge = ({ deadline, completion_date, status }) => {
    if (completion_date || status === 'Completed') {
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Done</span>;
    }
    if (!deadline) return <span className="text-slate-300 text-xs">—</span>;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dl = new Date(deadline);
    dl.setHours(0, 0, 0, 0);
    const diff = differenceInDays(dl, today);

    if (diff < 0) {
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">{Math.abs(diff)}d over</span>;
    }
    if (diff === 0) {
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">Today</span>;
    }
    if (diff <= 3) {
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{diff}d left</span>;
    }
    if (diff <= 7) {
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-50 text-yellow-600">{diff}d</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">{diff}d</span>;
};

// ── Inline Calendar Picker ─────────────────────────────────────────────────────
const DeadlinePicker = ({ value, onSave, onClose }) => {
    const [date, setDate] = useState(value || '');
    return (
        <div className="absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 min-w-52">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Extend Deadline</p>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mb-3" />
            <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50">Cancel</button>
                <button onClick={() => { onSave(date); onClose(); }} className="flex-1 py-2 text-xs rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800">Save</button>
            </div>
        </div>
    );
};

// ── Steno Comment Popup ────────────────────────────────────────────────────────
const StenoPopup = ({ value, onSave, onClose }) => {
    const [text, setText] = useState(value || '');
    return (
        <div className="absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 w-72">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Steno / Follow-up Comment</p>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
                placeholder="Add follow-up note..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none mb-3" />
            <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50">Cancel</button>
                <button onClick={() => { onSave(text); onClose(); }} className="flex-1 py-2 text-xs rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800">Save</button>
            </div>
        </div>
    );
};

// ── Inline Edit Row ────────────────────────────────────────────────────────────
const PRIORITY_OPTIONS = ['Low', 'Normal', 'High', 'Critical'];
const STATUS_OPTIONS = ['Pending', 'Completed', 'Overdue'];

const EditableRow = ({ task, onSave, onCancel, departments = [], employees = [] }) => {
    const [form, setForm] = useState({
        task_number: task.task_number || '',
        description: task.description || '',
        assigned_agency: task.assigned_agency || '',
        assigned_employee_id: task.assigned_employee_id || '',
        allocated_date: task.allocated_date || '',
        time_given: task.time_given || '',
        deadline_date: task.deadline_date || '',
        steno_comment: task.steno_comment || '',
        status: task.status || 'Pending',
        priority: task.priority || 'Normal',
        department_id: task.department_id || '',
    });

    const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

    const inputCls = "w-full px-2 py-1 rounded-lg border border-indigo-300 dark:border-indigo-500/50 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50";
    const selectCls = "w-full px-2 py-1 rounded-lg border border-indigo-300 dark:border-indigo-500/50 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50";
    const sortedEmployees = sortEmployeesForSelect(employees);

    return (
        <tr className="bg-indigo-50/60 dark:bg-indigo-900/20 border-y-2 border-indigo-200 dark:border-indigo-500/30">
            <td className="px-3 py-2 w-10">
                <div className="flex flex-col gap-1">
                    <button onClick={() => onSave(form)} className="p-1.5 rounded-lg bg-indigo-700 text-white hover:bg-indigo-800 transition-colors"><Save size={12} /></button>
                    <button onClick={onCancel} className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"><X size={12} /></button>
                </div>
            </td>
            <td className="px-2 py-2"><div className="text-xs text-slate-400 font-mono">{form.task_number}</div></td>
            <td className="px-2 py-2 min-w-48"><textarea value={form.description} onChange={f('description')} rows={2} className={inputCls + " resize-none"} placeholder="Task description" /></td>
            <td className="px-2 py-2"><textarea value={form.steno_comment} onChange={f('steno_comment')} rows={2} className={inputCls + " resize-none"} placeholder="Comment..." /></td>
            <td className="px-2 py-2 min-w-32 flex flex-col gap-1">
                <select value={form.assigned_employee_id} onChange={f('assigned_employee_id')} className={selectCls}>
                    <option value="">No Employee</option>
                    {sortedEmployees.map((e) => <option key={e.id} value={e.id}>{getEmployeeSelectLabel(e)}</option>)}
                </select>
                <input value={form.assigned_agency} onChange={f('assigned_agency')} className={inputCls} placeholder="Other Agency" />
            </td>
            <td className="px-2 py-2"><input type="date" value={form.allocated_date} onChange={f('allocated_date')} className={inputCls} /></td>
            <td className="px-2 py-2"><input value={form.time_given} onChange={f('time_given')} className={inputCls} placeholder="e.g. 30 days" /></td>
            <td className="px-2 py-2"><input type="date" value={form.deadline_date} onChange={f('deadline_date')} className={inputCls} /></td>
            <td className="px-2 py-2">
                <select value={form.priority} onChange={f('priority')} className={selectCls}>
                    {PRIORITY_OPTIONS.map(p => <option key={p}>{p}</option>)}
                </select>
                <select value={form.status} onChange={f('status')} className={selectCls + " mt-1"}>
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
            </td>
            <td className="px-2 py-2" />
        </tr>
    );
};

// ── Column Header ──────────────────────────────────────────────────────────────
const ColHeader = ({ label, sortKey, currentSort, onSort, className = '' }) => {
    const active = currentSort?.key === sortKey;
    return (
        <th onClick={() => sortKey && onSort(sortKey)}
            className={`px-3 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400 select-none whitespace-nowrap ${sortKey ? 'cursor-pointer hover:text-indigo-600 transition-colors' : ''} ${className}`}>
            <div className="flex items-center gap-1">
                {label}
                {sortKey && (
                    <span className="ml-0.5">
                        {active ? (
                            currentSort.dir === 'asc' ? <ChevronUp size={11} className="text-indigo-600" /> : <ChevronDown size={11} className="text-indigo-600" />
                        ) : <ChevronsUpDown size={11} className="text-slate-300" />}
                    </span>
                )}
            </div>
        </th>
    );
};

const buildTaskWhatsAppMessage = (task) => {
    const taskName = (task?.description || '').trim() || 'Task';
    const assignedTo = (task?.assigned_employee_name || task?.assigned_agency || '').trim() || 'Unassigned';
    return `What's the status of this task? - '${taskName}' assigned to '${assignedTo}'`;
};

const getEmployeeSelectLabel = (employee) => {
    const displayName = String(employee?.display_username || '').trim();
    if (displayName) return displayName;
    const fallback = String(employee?.name || '').trim();
    return fallback || `Employee ${employee?.id || ''}`.trim();
};

const sortEmployeesForSelect = (rows = []) => (
    [...rows].sort((a, b) => (
        getEmployeeSelectLabel(a).localeCompare(getEmployeeSelectLabel(b), undefined, { sensitivity: 'base' })
    ))
);

const normalizeLabel = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const JP_CEO_AREA_ALIASES = {
    dantewada: ['dantewada', 'dnt', 'dtw'],
    geedam: ['geedam', 'gidam', 'gdm'],
    kuakonda: ['kuakonda', 'kua', 'kuak'],
    katekalyan: ['katekalyan', 'katakalyan', 'kateklyan', 'katek'],
};

const employeeSearchBlob = (employee) => normalizeLabel(
    `${employee?.display_username || ''} ${employee?.name || ''} ${employee?.department_name || ''}`
);

const hasAreaAlias = (text) => (
    Object.values(JP_CEO_AREA_ALIASES).some((aliases) => aliases.some((alias) => text.includes(alias)))
);

const isAllCeosEmployee = (employee) => {
    if (!employee) return false;
    const label = normalizeLabel(employee.display_username || employee.name);
    return label === 'allceos' || label === 'allceo';
};

const isJpCeoEmployee = (employee) => {
    if (!employee) return false;
    if (isAllCeosEmployee(employee)) return false;
    const text = employeeSearchBlob(employee);
    if (!text.includes('ceo')) return false;
    const hasArea = hasAreaAlias(text);
    if (!hasArea) return false;
    return text.includes('jp') || text.includes('janpad') || text.includes('block') || hasArea;
};

const getRecipientNumbersForEmployee = (employee, allEmployees = []) => {
    if (!employee) return [];
    if (isAllCeosEmployee(employee)) {
        const jpCeos = (allEmployees || []).filter(isJpCeoEmployee);
        const numbers = jpCeos.map((row) => normalizeWhatsAppNumber(row?.mobile_number)).filter(Boolean);
        return [...new Set(numbers)];
    }
    const phone = normalizeWhatsAppNumber(employee.mobile_number);
    return phone ? [phone] : [];
};

const openWhatsAppToNumbers = (numbers = [], message = '') => {
    const unique = [...new Set((numbers || []).filter(Boolean))];
    const text = encodeURIComponent(String(message || '').trim());
    if (!text) return;
    unique.forEach((number, idx) => {
        setTimeout(() => {
            window.open(
                `https://api.whatsapp.com/send/?phone=${number}&text=${text}&type=phone_number&app_absent=0`,
                '_blank',
                'noopener,noreferrer'
            );
        }, idx * 200);
    });
};

const getTodayIso = () => new Date().toISOString().slice(0, 10);
const normalizeWhatsAppNumber = (value) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length === 10) digits = `91${digits}`;
    return digits;
};
const formatTime12 = (value) => {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return text || 'TBD';
    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${suffix}`;
};

const CLAMP_TWO_LINES = {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
};

const ScheduleTaskMeetingPopover = ({ isOpen, task, departments = [], employees = [], allTasks = [], onClose, onSave }) => {
    const [form, setForm] = useState({
        title: '',
        date: getTodayIso(),
        time_slot: '10:00',
        duration_minutes: 30,
        venue: '',
        department_id: '',
    });
    const [primaryRecipientId, setPrimaryRecipientId] = useState('');
    const [messageDraft, setMessageDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const sortedEmployees = sortEmployeesForSelect(employees);

    useEffect(() => {
        if (!isOpen || !task) return;
        const autoRecipientId = task.assigned_employee_id ? String(task.assigned_employee_id) : '';
        setForm({
            title: (task.description || task.task_number || 'Task Meeting').slice(0, 120),
            date: getTodayIso(),
            time_slot: '10:00',
            duration_minutes: 30,
            venue: '',
            department_id: task.department_id || '',
        });
        setPrimaryRecipientId(autoRecipientId);
        setSaving(false);
    }, [isOpen, task]);

    useEffect(() => {
        if (!isOpen || !task) return;
        const date = form.date ? format(new Date(form.date), 'd MMMM yyyy') : 'TBD';
        const time = formatTime12(form.time_slot);
        const recipient = employees.find((emp) => String(emp.id) === String(primaryRecipientId));
        const personName = recipient?.name || task?.assigned_employee_name || task?.assigned_agency || 'the concerned officer';
        const taskName = (task?.description || '').trim() || task?.task_number || 'Task';
        const personTasks = recipient
            ? allTasks
                .filter((row) => String(row.assigned_employee_id || '') === String(recipient.id))
                .slice(0, 8)
            : [];
        const lines = personTasks.map((row, idx) => `${idx + 1}. ${(row.description || row.task_number || '').trim()}`).filter(Boolean);
        const summary = lines.length
            ? `\n\nPlease review status of the following tasks:\n${lines.join('\n')}`
            : '';
        setMessageDraft(`Meeting to be scheduled with ${personName} on ${date} at ${time} on task "${taskName}".${summary}`);
    }, [isOpen, task, form.date, form.time_slot, primaryRecipientId, employees, allTasks]);

    if (!isOpen || !task) return null;

    const sendWhatsApp = () => {
        const recipient = employees.find((emp) => String(emp.id) === String(primaryRecipientId));
        const phones = getRecipientNumbersForEmployee(recipient, employees);
        if (!phones.length) {
            window.alert('Select a recipient with a valid mobile number');
            return;
        }
        if (!(messageDraft || '').trim()) {
            window.alert('Message draft cannot be empty');
            return;
        }
        openWhatsAppToNumbers(phones, messageDraft);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.date || !form.time_slot) return;
        setSaving(true);
        try {
            await onSave({
                ...form,
                duration_minutes: parseInt(form.duration_minutes, 10) || 30,
                department_id: form.department_id ? parseInt(form.department_id, 10) : null,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

    const currentRecipient = employees.find((emp) => String(emp.id) === String(primaryRecipientId));

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            className="absolute right-0 top-full mt-2 z-[70] glass-card rounded-2xl w-[420px] shadow-premium-lg border border-slate-200 dark:border-white/10"
        >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white rounded-t-2xl">
                <div>
                    <h3 className="text-sm font-black text-slate-800">Schedule Task Meeting</h3>
                    <p className="text-[11px] text-slate-400">Create a planner slot from this row</p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
                    <X size={14} className="text-slate-400" />
                </button>
            </div>

            <form onSubmit={submit} className="p-4 space-y-2.5">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Title</label>
                    <input
                        required
                        value={form.title}
                        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                        className={inputCls}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date</label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Time</label>
                        <input
                            type="time"
                            value={form.time_slot}
                            onChange={(e) => setForm((prev) => ({ ...prev, time_slot: e.target.value }))}
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Duration</label>
                        <select
                            value={form.duration_minutes}
                            onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                            className={inputCls}
                        >
                            <option value={30}>30m</option>
                            <option value={60}>60m</option>
                            <option value={90}>90m</option>
                            <option value={120}>120m</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Department</label>
                        <select
                            value={form.department_id}
                            onChange={(e) => setForm((prev) => ({ ...prev, department_id: e.target.value }))}
                            className={inputCls}
                        >
                            <option value="">None</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Venue</label>
                    <input
                        value={form.venue}
                        onChange={(e) => setForm((prev) => ({ ...prev, venue: e.target.value }))}
                        placeholder="Meeting room / location"
                        className={inputCls}
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Meeting With</label>
                    <select
                        value={primaryRecipientId}
                        onChange={(e) => setPrimaryRecipientId(e.target.value)}
                        className={inputCls}
                    >
                        <option value="">Select person</option>
                        {sortedEmployees.map((emp) => (
                            <option key={emp.id} value={emp.id}>{getEmployeeSelectLabel(emp)}</option>
                        ))}
                    </select>
                    {currentRecipient?.mobile_number && (
                        <p className="text-[10px] text-slate-400 mt-1">
                            Recipient mobile: {currentRecipient.mobile_number}
                        </p>
                    )}
                    {isAllCeosEmployee(currentRecipient) && (
                        <p className="text-[10px] text-indigo-500 mt-1 font-semibold">
                            This sends to all JP CEOs (Dantewada, Geedam, Kuakonda, Katekalyan).
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Message Draft</label>
                    <textarea
                        rows={6}
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        className={`${inputCls} resize-none`}
                    />
                </div>

                <div className="pt-1 flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">
                        Cancel
                    </button>
                    <button type="button" onClick={sendWhatsApp} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">
                        Send WA
                    </button>
                    <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60">
                        {saving ? 'Scheduling…' : 'Schedule'}
                    </button>
                </div>
            </form>
        </motion.div>
    );
};

// ── Main TaskTable ─────────────────────────────────────────────────────────────
const TaskTable = ({
    tasks = [],
    allTasks = [],
    departments = [],
    employees = [],
    onUpdate,
    onDelete,
    onScheduleTask,
    isAdmin = false,
    selectedIds = [],
    onSelectChange,
    bulkMode = false,
    sort = { key: 'deadline_date', dir: 'asc' },
    onSortChange = null,
}) => {
    const [editId, setEditId] = useState(null);
    const [calendarId, setCalendarId] = useState(null);
    const [stenoId, setStenoId] = useState(null);
    const [bulkDrafts, setBulkDrafts] = useState({});
    const [savingCells, setSavingCells] = useState({});
    const [scheduleTask, setScheduleTask] = useState(null);
    const calendarRef = useRef(null);
    const stenoRef = useRef(null);
    const scheduleRef = useRef(null);

    // Close popups on outside click
    useEffect(() => {
        const handler = (e) => {
            if (calendarRef.current && !calendarRef.current.contains(e.target)) setCalendarId(null);
            if (stenoRef.current && !stenoRef.current.contains(e.target)) setStenoId(null);
            if (scheduleRef.current && !scheduleRef.current.contains(e.target)) setScheduleTask(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!bulkMode) {
            setBulkDrafts({});
            setSavingCells({});
            return;
        }
        setBulkDrafts((prev) => {
            const validIds = new Set((tasks || []).map((t) => t.id));
            const next = {};
            Object.entries(prev).forEach(([id, data]) => {
                if (validIds.has(parseInt(id, 10))) next[id] = data;
            });
            return next;
        });
    }, [bulkMode, tasks]);

    const handleSort = (key) => {
        if (!onSortChange) return;
        const defaultDir = ['allocated_date', 'created_at'].includes(key) ? 'desc' : 'asc';
        const nextDir = sort?.key === key ? (sort?.dir === 'asc' ? 'desc' : 'asc') : defaultDir;
        onSortChange({ key, dir: nextDir });
    };

    const handleSaveEdit = async (id, form) => {
        const payload = { ...form };
        if (payload.department_id === '') payload.department_id = null;
        else if (payload.department_id) payload.department_id = parseInt(payload.department_id);
        if (payload.assigned_employee_id === '') payload.assigned_employee_id = null;
        else if (payload.assigned_employee_id) payload.assigned_employee_id = parseInt(payload.assigned_employee_id);
        await onUpdate(id, payload);
        setEditId(null);
    };

    const handleQuickAction = async (id, patch) => {
        await onUpdate(id, patch);
    };

    const setBulkField = (taskId, field, value) => {
        setBulkDrafts((prev) => ({
            ...prev,
            [taskId]: {
                ...(prev[taskId] || {}),
                [field]: value,
            },
        }));
    };

    const clearBulkField = (taskId, field) => {
        setBulkDrafts((prev) => {
            const row = { ...(prev[taskId] || {}) };
            delete row[field];
            const next = { ...prev };
            if (Object.keys(row).length === 0) delete next[taskId];
            else next[taskId] = row;
            return next;
        });
    };

    const getBulkFieldValue = (task, field) => {
        const rowDraft = bulkDrafts[task.id] || {};
        if (Object.prototype.hasOwnProperty.call(rowDraft, field)) {
            return rowDraft[field];
        }
        return task[field] ?? '';
    };

    const commitBulkField = async (task, field, rawOverride = undefined) => {
        const rowDraft = bulkDrafts[task.id] || {};
        const hasDraft = Object.prototype.hasOwnProperty.call(rowDraft, field);
        if (!hasDraft && rawOverride === undefined) return;

        let nextValue = rawOverride !== undefined ? rawOverride : rowDraft[field];
        let currentValue = task[field];

        if (field === 'assigned_employee_id' || field === 'department_id') {
            nextValue = (nextValue === '' || nextValue === null) ? null : parseInt(nextValue, 10);
            currentValue = currentValue ?? null;
        } else if (field === 'allocated_date' || field === 'deadline_date') {
            nextValue = nextValue || null;
            currentValue = currentValue || null;
        } else {
            nextValue = nextValue ?? '';
            currentValue = currentValue ?? '';
        }

        if (String(nextValue ?? '') === String(currentValue ?? '')) {
            clearBulkField(task.id, field);
            return;
        }

        const key = `${task.id}:${field}`;
        setSavingCells((prev) => ({ ...prev, [key]: true }));
        try {
            await onUpdate(task.id, { [field]: nextValue });
            clearBulkField(task.id, field);
        } finally {
            setSavingCells((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const handleDeadline = async (id, date) => {
        await onUpdate(id, { deadline_date: date });
        setCalendarId(null);
    };

    const handleSteno = async (id, text) => {
        await onUpdate(id, { steno_comment: text });
        setStenoId(null);
    };

    const toggleSelect = (id) => {
        if (!onSelectChange) return;
        onSelectChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
    };

    const toggleAll = () => {
        if (!onSelectChange) return;
        onSelectChange(selectedIds.length === tasks.length ? [] : tasks.map(t => t.id));
    };

    const sorted = tasks;
    const sortedEmployees = sortEmployeesForSelect(employees);
    const employeeById = new Map(sortedEmployees.map((emp) => [String(emp.id), emp]));

    if (tasks.length === 0) return null;

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm">
                <thead>
                    <tr className="border-b-2 border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/2">
                        {(isAdmin && bulkMode) && (
                            <th className="px-3 py-3 w-10">
                                <input type="checkbox" checked={selectedIds.length === tasks.length && tasks.length > 0}
                                    onChange={toggleAll}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer" />
                            </th>
                        )}
                        <ColHeader label="S.No" className="w-12" />
                        <ColHeader label="Task #" sortKey="task_number" currentSort={sort} onSort={handleSort} className="w-24" />
                        <ColHeader label="Due In" sortKey="deadline_date" currentSort={sort} onSort={handleSort} className="w-20" />
                        <ColHeader label="Task / Description" sortKey="description" currentSort={sort} onSort={handleSort} className="min-w-[360px]" />
                        <ColHeader label="Comments" className="w-[28rem]" />
                        <ColHeader label="Assigned" sortKey="assigned_agency" currentSort={sort} onSort={handleSort} className="w-32" />
                        <ColHeader label="Alloc." sortKey="allocated_date" currentSort={sort} onSort={handleSort} className="w-24" />
                        <ColHeader label="Time" className="w-20" />
                        <ColHeader label="Deadline" sortKey="deadline_date" currentSort={sort} onSort={handleSort} className="w-24" />
                        {isAdmin && <th className="px-3 py-3 text-xs font-black uppercase tracking-widest text-slate-400 w-48">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {sorted.map((task, idx) => {
                        if (editId === task.id) {
                            return (
                                <EditableRow key={task.id} task={task} departments={departments} employees={employees}
                                    onSave={(form) => handleSaveEdit(task.id, form)}
                                    onCancel={() => setEditId(null)} />
                            );
                        }

                        const isSelected = selectedIds.includes(task.id);
                        const isCompleted = task.status === 'Completed' || !!task.completion_date;
                        const isPinned = task.is_pinned;
                        const isToday = task.is_today;
                        const isImportant = task.priority === 'High' || task.priority === 'Critical';
                        const isBulkEditable = Boolean(isAdmin && bulkMode);
                        const taskAssignedEmployee = employeeById.get(String(task.assigned_employee_id || ''));
                        const quickRecipientNumbers = getRecipientNumbersForEmployee(taskAssignedEmployee, sortedEmployees);
                        const inputCls = "w-full px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-500/40 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/40";

                        return (
                            <tr key={task.id}
                                className={`group transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10
                                    ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}
                                    ${isCompleted ? 'opacity-60' : ''}
                                `}>

                                {/* Checkbox (bulk mode) */}
                                {(isAdmin && bulkMode) && (
                                    <td className="px-3 py-3">
                                        <input type="checkbox" checked={isSelected}
                                            onChange={() => toggleSelect(task.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer" />
                                    </td>
                                )}

                                {/* S.No */}
                                <td className="px-3 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>

                                {/* Task # */}
                                <td className="px-3 py-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-black text-xs font-mono text-indigo-700 dark:text-indigo-300">{task.task_number}</span>
                                        {task.source === 'action_point' && (
                                            <span className="text-[10px] text-violet-500 font-semibold">↑ from review</span>
                                        )}
                                    </div>
                                </td>

                                {/* Due In */}
                                <td className="px-3 py-3">
                                    <DueInBadge deadline={task.deadline_date} completion_date={task.completion_date} status={task.status} />
                                </td>

                                {/* Task Description */}
                                <td className="px-3 py-3 min-w-[320px] align-middle">
                                    {isBulkEditable ? (
                                        <div className="space-y-1">
                                            <textarea
                                                rows={2}
                                                value={getBulkFieldValue(task, 'description')}
                                                onChange={(e) => setBulkField(task.id, 'description', e.target.value)}
                                                onBlur={() => commitBulkField(task, 'description')}
                                                className={`${inputCls} resize-none`}
                                                placeholder="Task description"
                                            />
                                            {savingCells[`${task.id}:description`] && (
                                                <p className="text-[10px] text-indigo-500 font-semibold">Saving...</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="min-h-[64px] flex flex-col justify-center gap-0.5">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug whitespace-normal break-words">
                                                {task.description || <span className="text-slate-300 italic">No description</span>}
                                            </p>
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Today</span>}
                                            </div>
                                        </div>
                                    )}
                                </td>

                                {/* Steno Comment */}
                                <td className="px-3 py-3 min-w-[260px] max-w-[360px]" ref={stenoId === task.id ? stenoRef : null}>
                                    {isBulkEditable ? (
                                        <div className="space-y-1">
                                            <textarea
                                                rows={2}
                                                value={getBulkFieldValue(task, 'steno_comment')}
                                                onChange={(e) => setBulkField(task.id, 'steno_comment', e.target.value)}
                                                onBlur={() => commitBulkField(task, 'steno_comment')}
                                                placeholder="Comment..."
                                                className={`${inputCls} resize-none`}
                                            />
                                            {savingCells[`${task.id}:steno_comment`] && (
                                                <p className="text-[10px] text-indigo-500 font-semibold">Saving...</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            {task.steno_comment ? (
                                                <button onClick={() => setStenoId(stenoId === task.id ? null : task.id)}
                                                    className="text-xs text-slate-500 dark:text-slate-400 text-left hover:text-indigo-600 transition-colors leading-snug"
                                                    style={CLAMP_TWO_LINES}>
                                                    {task.steno_comment}
                                                </button>
                                            ) : isAdmin ? (
                                                <button onClick={() => setStenoId(stenoId === task.id ? null : task.id)}
                                                    className="text-xs text-slate-300 hover:text-indigo-500 transition-colors flex items-center gap-1">
                                                    <MessageSquare size={12} /> Add note
                                                </button>
                                            ) : <span className="text-slate-300 text-xs">—</span>}

                                            <AnimatePresence>
                                                {stenoId === task.id && isAdmin && (
                                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                                        className="absolute left-0 top-full mt-1" ref={stenoRef}>
                                                        <StenoPopup value={task.steno_comment}
                                                            onSave={(text) => handleSteno(task.id, text)}
                                                            onClose={() => setStenoId(null)} />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </td>

                                {/* Assigned Agency / Employee */}
                                <td className="px-3 py-3 max-w-[130px]">
                                    {isBulkEditable ? (
                                        <div className="space-y-1">
                                            <select
                                                value={getBulkFieldValue(task, 'assigned_employee_id') ?? ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setBulkField(task.id, 'assigned_employee_id', value);
                                                    commitBulkField(task, 'assigned_employee_id', value);
                                                }}
                                                className={inputCls}
                                            >
                                                <option value="">No employee</option>
                                                {sortedEmployees.map((emp) => (
                                                    <option key={emp.id} value={emp.id}>{getEmployeeSelectLabel(emp)}</option>
                                                ))}
                                            </select>
                                            <input
                                                value={getBulkFieldValue(task, 'assigned_agency')}
                                                onChange={(e) => setBulkField(task.id, 'assigned_agency', e.target.value)}
                                                onBlur={() => commitBulkField(task, 'assigned_agency')}
                                                className={inputCls}
                                                placeholder="Other agency"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            {task.assigned_employee_name ? (
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{task.assigned_employee_name}</p>
                                            ) : (
                                                <p className="text-xs text-slate-500">—</p>
                                            )}
                                            {task.assigned_agency && (
                                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{task.assigned_agency}</p>
                                            )}
                                        </>
                                    )}
                                </td>

                                {/* Allocated Date */}
                                <td className="px-3 py-3 whitespace-nowrap">
                                    {isBulkEditable ? (
                                        <input
                                            type="date"
                                            value={getBulkFieldValue(task, 'allocated_date') || ''}
                                            onChange={(e) => setBulkField(task.id, 'allocated_date', e.target.value)}
                                            onBlur={() => commitBulkField(task, 'allocated_date')}
                                            className={inputCls}
                                        />
                                    ) : (
                                        <span className="text-xs text-slate-500">
                                            {task.allocated_date ? format(new Date(task.allocated_date), 'd MMM yy') : '—'}
                                        </span>
                                    )}
                                </td>

                                {/* Time Given */}
                                <td className="px-3 py-3">
                                    {isBulkEditable ? (
                                        <input
                                            value={getBulkFieldValue(task, 'time_given')}
                                            onChange={(e) => setBulkField(task.id, 'time_given', e.target.value)}
                                            onBlur={() => commitBulkField(task, 'time_given')}
                                            className={inputCls}
                                            placeholder="e.g. 7 days"
                                        />
                                    ) : (
                                        <span className="text-xs text-slate-500">{task.time_given || '—'}</span>
                                    )}
                                </td>

                                {/* Deadline */}
                                <td className="px-3 py-3 whitespace-nowrap" ref={calendarId === task.id ? calendarRef : null}>
                                    {isBulkEditable ? (
                                        <input
                                            type="date"
                                            value={getBulkFieldValue(task, 'deadline_date') || ''}
                                            onChange={(e) => setBulkField(task.id, 'deadline_date', e.target.value)}
                                            onBlur={() => commitBulkField(task, 'deadline_date')}
                                            className={inputCls}
                                        />
                                    ) : (
                                        <div className="relative">
                                            <span className={`text-xs font-semibold ${task.status === 'Overdue' ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {task.deadline_date ? format(new Date(task.deadline_date), 'd MMM yy') : '—'}
                                            </span>
                                            <AnimatePresence>
                                                {calendarId === task.id && (
                                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                                        className="absolute left-0 top-full mt-1" ref={calendarRef}>
                                                        <DeadlinePicker value={task.deadline_date}
                                                            onSave={(date) => handleDeadline(task.id, date)}
                                                            onClose={() => setCalendarId(null)} />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </td>

                                {/* Actions */}
                                {isAdmin && (
                                    <td className="px-3 py-3 relative" ref={scheduleTask?.id === task.id ? scheduleRef : null}>
                                        <div className={`flex items-center gap-0.5 transition-opacity ${scheduleTask?.id === task.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            {/* WhatsApp */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const msg = buildTaskWhatsAppMessage(task);
                                                    if (quickRecipientNumbers.length) {
                                                        openWhatsAppToNumbers(quickRecipientNumbers, msg);
                                                    } else {
                                                        window.open(
                                                            `https://api.whatsapp.com/send/?text=${encodeURIComponent(msg)}&type=custom_url&app_absent=0`,
                                                            '_blank',
                                                            'noopener,noreferrer'
                                                        );
                                                    }
                                                }}
                                                title="WhatsApp follow-up"
                                                className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 text-slate-400 hover:text-green-600 transition-colors"
                                            >
                                                <WhatsAppIcon />
                                            </button>

                                            {/* Edit inline */}
                                            {!bulkMode && (
                                                <button onClick={() => setEditId(task.id)} title="Edit"
                                                    className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-600 transition-colors">
                                                    <Edit2 size={13} />
                                                </button>
                                            )}

                                            {/* Extend deadline */}
                                            <button onClick={() => setCalendarId(calendarId === task.id ? null : task.id)} title="Extend deadline"
                                                className="p-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-500/10 text-slate-400 hover:text-violet-600 transition-colors">
                                                <Calendar size={13} />
                                            </button>

                                            {/* Schedule task meeting */}
                                            <button
                                                onClick={() => setScheduleTask(scheduleTask?.id === task.id ? null : task)}
                                                title="Schedule meeting in planner"
                                                className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-600 transition-colors"
                                            >
                                                <CalendarClock size={13} />
                                            </button>

                                            {/* Quick Complete */}
                                            <button onClick={() => handleQuickAction(task.id, {
                                                status: isCompleted ? 'Pending' : 'Completed',
                                                completion_date: isCompleted ? null : new Date().toISOString().split('T')[0]
                                            })} title={isCompleted ? 'Mark Pending' : 'Mark Complete'}
                                                className={`p-1.5 rounded-lg transition-colors ${isCompleted ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600'}`}>
                                                <CheckCircle2 size={13} />
                                            </button>

                                            {/* Flag Important */}
                                            <button onClick={() => handleQuickAction(task.id, {
                                                priority: isImportant ? 'Normal' : 'High'
                                            })} title={isImportant ? 'Unflag' : 'Flag Important'}
                                                className={`p-1.5 rounded-lg transition-colors ${isImportant ? 'text-orange-500 hover:bg-orange-50' : 'text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-500'}`}>
                                                <Flag size={13} />
                                            </button>

                                            {/* Pin to Today */}
                                            <button onClick={() => handleQuickAction(task.id, {
                                                is_today: !isToday,
                                                is_pinned: false
                                            })} title={isToday ? 'Unmark Today' : 'Mark Today'}
                                                className={`p-1.5 rounded-lg transition-colors ${isToday ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-500'}`}>
                                                <Pin size={13} />
                                            </button>

                                            {/* Delete */}
                                            <button onClick={() => onDelete(task.id)} title="Delete"
                                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {scheduleTask?.id === task.id && (
                                                <ScheduleTaskMeetingPopover
                                                    isOpen
                                                    task={scheduleTask}
                                                    departments={departments}
                                                    employees={employees}
                                                    allTasks={allTasks}
                                                    onClose={() => setScheduleTask(null)}
                                                    onSave={(payload) => onScheduleTask ? onScheduleTask(scheduleTask, payload) : Promise.resolve()}
                                                />
                                            )}
                                        </AnimatePresence>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>

        </div>
    );
};

export default React.memo(TaskTable);
