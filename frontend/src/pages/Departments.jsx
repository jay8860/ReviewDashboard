import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Plus, Trash2, Edit2, ArrowRight, X,
    LayoutGrid,
    List, ArrowUp, ArrowDown, FolderPlus, CalendarPlus, Calendar
} from 'lucide-react';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { api } from '../services/api';

const COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal', 'orange'];
const PRIORITY_OPTIONS = ['Critical', 'High', 'Normal', 'Low'];

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

const normalizePriority = (value) => {
    const val = (value || '').trim().toLowerCase();
    if (val === 'critical') return 'Critical';
    if (val === 'high') return 'High';
    if (val === 'low') return 'Low';
    return 'Normal';
};

const normalizeDepartment = (dept, idx) => ({
    ...dept,
    category_name: (dept.category_name || 'General').trim() || 'General',
    category_order: Number.isFinite(dept.category_order) ? dept.category_order : 0,
    display_order: Number.isFinite(dept.display_order) ? dept.display_order : idx,
    priority_level: normalizePriority(dept.priority_level),
});

const reviewTickerText = (dept) => {
    const days = dept?.review_health?.days_since_last_review;
    if (days === null || days === undefined) return 'Last review: Never reviewed';
    if (days === 0) return 'Last review: Today';
    if (days === 1) return 'Last review: 1 day ago';
    return `Last review: ${days} days ago`;
};

const WAIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const formatDateSafe = (value) => {
    if (!value) return 'TBD';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'TBD';
    return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const buildCategoryBuckets = (departments) => {
    const map = new Map();

    departments.forEach((dept, idx) => {
        const normalized = normalizeDepartment(dept, idx);
        const key = normalized.category_name;
        if (!map.has(key)) {
            map.set(key, {
                name: key,
                order: normalized.category_order,
                departments: [],
            });
        }
        const bucket = map.get(key);
        bucket.order = Math.min(
            Number.isFinite(bucket.order) ? bucket.order : 0,
            Number.isFinite(normalized.category_order) ? normalized.category_order : 0
        );
        bucket.departments.push(normalized);
    });

    return Array.from(map.values())
        .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name))
        .map(bucket => ({
            ...bucket,
            departments: [...bucket.departments].sort((a, b) => (a.display_order - b.display_order) || a.name.localeCompare(b.name)),
        }));
};

const DeptModal = ({ isOpen, onClose, onSave, initial = null, categoryOptions = [] }) => {
    const [form, setForm] = useState({
        name: '',
        short_name: '',
        description: '',
        category_name: 'General',
        priority_level: 'Normal',
        head_name: '',
        head_designation: '',
        color: 'indigo',
    });

    useEffect(() => {
        if (initial) {
            setForm({
                name: initial.name || '',
                short_name: initial.short_name || '',
                description: initial.description || '',
                category_name: initial.category_name || 'General',
                priority_level: normalizePriority(initial.priority_level),
                head_name: initial.head_name || '',
                head_designation: initial.head_designation || '',
                color: initial.color || 'indigo',
            });
            return;
        }
        setForm({
            name: '',
            short_name: '',
            description: '',
            category_name: 'General',
            priority_level: 'Normal',
            head_name: '',
            head_designation: '',
            color: 'indigo',
        });
    }, [initial, isOpen]);

    const normalizedCategoryOptions = useMemo(() => {
        const seed = ['General', ...(categoryOptions || [])];
        const map = new Map();
        seed.forEach((name) => {
            const value = String(name || '').trim();
            if (!value) return;
            const key = value.toLowerCase();
            if (!map.has(key)) map.set(key, value);
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [categoryOptions]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...form,
            category_name: (form.category_name || '').trim() || 'General',
            priority_level: normalizePriority(form.priority_level),
        });
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-md shadow-premium-lg max-h-[92vh] overflow-y-auto custom-scrollbar"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">{initial ? 'Edit' : 'New'} Department</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Department Name *</label>
                            <input
                                required
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Education Department"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Short Name</label>
                                <input
                                    value={form.short_name}
                                    onChange={e => setForm({ ...form, short_name: e.target.value })}
                                    placeholder="e.g. EDU"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Priority</label>
                                <select
                                    value={form.priority_level}
                                    onChange={e => setForm({ ...form, priority_level: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                >
                                    {PRIORITY_OPTIONS.map(level => <option key={level} value={level}>{level}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Category Bucket</label>
                            <div className="grid grid-cols-1 gap-2">
                                <select
                                    value={form.category_name}
                                    onChange={e => setForm({ ...form, category_name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                >
                                    {normalizedCategoryOptions.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                                <input
                                    value={form.category_name}
                                    onChange={e => setForm({ ...form, category_name: e.target.value })}
                                    placeholder="Or type a new category"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Nodal Officer / Head</label>
                            <input
                                value={form.head_name}
                                onChange={e => setForm({ ...form, head_name: e.target.value })}
                                placeholder="Name"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Designation</label>
                            <input
                                value={form.head_designation}
                                onChange={e => setForm({ ...form, head_designation: e.target.value })}
                                placeholder="e.g. District Education Officer"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Color</label>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {COLORS.map(c => (
                                    <button
                                        type="button"
                                        key={c}
                                        onClick={() => setForm({ ...form, color: c })}
                                        className={`w-6 h-6 rounded-full bg-gradient-to-br ${colorGrad[c]} transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-60 hover:opacity-100'}`}
                                    />
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Description</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={2}
                                placeholder="Brief description..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                {initial ? 'Save Changes' : 'Create'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const QuickScheduleModal = ({ department, agenda = [], employees = [], isOpen, onClose, onConfirm }) => {
    const today = new Date().toISOString().split('T')[0];
    const [form, setForm] = useState({
        scheduled_date: today,
        scheduled_time: '10:00',
        venue: '',
        attendees: '',
        officer_phone: '',
    });
    const [officerSearch, setOfficerSearch] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setForm({
            scheduled_date: today,
            scheduled_time: '10:00',
            venue: '',
            attendees: '',
            officer_phone: '',
        });
        setOfficerSearch('');
    }, [isOpen, department?.id, today]);

    if (!isOpen || !department) return null;
    const openAgenda = agenda.filter(item => item.status === 'Open');
    const matchedEmployees = useMemo(() => {
        const q = officerSearch.trim().toLowerCase();
        if (q.length < 1) return [];
        return (employees || [])
            .filter(emp => emp?.is_active !== false)
            .filter(emp => (`${emp?.name || ''} ${emp?.display_username || ''} ${emp?.mobile_number || ''}`).toLowerCase().includes(q))
            .slice(0, 8);
    }, [officerSearch, employees]);
    const waMsg = `Meeting Agenda - ${department.name}\nDate: ${formatDateSafe(form.scheduled_date)}${form.scheduled_time ? `\nTime: ${form.scheduled_time}` : ''}${form.venue ? `\nVenue: ${form.venue}` : ''}${form.attendees ? `\nAttendees: ${form.attendees}` : ''}\n\nAgenda Points:\n${openAgenda.map((a, i) => `${i + 1}. ${a.title}${a.details ? `\n   - ${a.details}` : ''}`).join('\n')}\n\nPlease ensure your presence and come prepared.`;
    const waLink = form.officer_phone
        ? `https://wa.me/${form.officer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="glass-card rounded-3xl w-full max-w-lg shadow-premium-lg max-h-[92vh] overflow-y-auto custom-scrollbar"
                >
                    <div className="px-7 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-500/5 dark:to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <Calendar size={16} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black dark:text-white">Schedule Meeting</h2>
                                <p className="text-xs text-slate-400">{department.name} — Department-wide meeting</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} className="text-slate-400" /></button>
                    </div>

                    <div className="p-7 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Date *</label>
                                <input
                                    type="date"
                                    value={form.scheduled_date}
                                    onChange={e => setForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Time *</label>
                                <input
                                    type="time"
                                    value={form.scheduled_time}
                                    onChange={e => setForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Venue</label>
                                <input
                                    value={form.venue}
                                    onChange={e => setForm(prev => ({ ...prev, venue: e.target.value }))}
                                    placeholder="Meeting room / location"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Attendees</label>
                            <input
                                value={form.attendees}
                                onChange={e => setForm(prev => ({ ...prev, attendees: e.target.value }))}
                                placeholder="Comma separated names"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Officer WhatsApp (Search Employee)</label>
                            <input
                                value={officerSearch}
                                onChange={e => setOfficerSearch(e.target.value)}
                                placeholder="Search DEO / username / mobile..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
                            />
                            {matchedEmployees.length > 0 && (
                                <div className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                                    {matchedEmployees.map(emp => (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            onClick={() => {
                                                setForm(prev => ({ ...prev, officer_phone: emp.mobile_number || '' }));
                                                setOfficerSearch(emp.display_username || emp.name || '');
                                            }}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/10 border-b border-slate-100 dark:border-white/10 last:border-b-0"
                                        >
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{emp.display_username || emp.name}</p>
                                            <p className="text-[11px] text-slate-500">{emp.mobile_number || 'No mobile'}{emp.name && emp.display_username ? ` · ${emp.name}` : ''}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <input
                                value={form.officer_phone}
                                onChange={e => setForm(prev => ({ ...prev, officer_phone: e.target.value }))}
                                placeholder="+91XXXXXXXXXX"
                                className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
                            />
                        </div>
                        {openAgenda.length > 0 && (
                            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-4">
                                <p className="text-xs font-black uppercase text-slate-400 mb-2">Agenda snapshot ({openAgenda.length} open items)</p>
                                <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                                    {openAgenda.map((a, i) => (
                                        <p key={a.id} className="text-xs text-slate-600 dark:text-slate-300">
                                            <span className="font-bold text-slate-400">{i + 1}.</span> {a.title}
                                        </p>
                                    ))}
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
                            <button onClick={() => form.scheduled_date && onConfirm(form)}
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

const DepartmentCard = ({
    dept,
    indexInCategory,
    totalInCategory,
    categoryNames,
    editMode,
    disabled,
    onEdit,
    onDelete,
    onOpen,
    onMove,
    onCategoryChange,
    onQuickSchedule,
}) => (
    <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass-card rounded-3xl overflow-hidden group transition-premium ${editMode ? 'hover:shadow-premium' : 'hover:shadow-premium cursor-pointer'}`}
        onClick={() => {
            if (!editMode) onOpen(dept.id);
        }}
    >
        <div className={`h-1.5 bg-gradient-to-r ${colorGrad[dept.color] || colorGrad.indigo}`} />
        <div className="p-4">
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorGrad[dept.color] || colorGrad.indigo} flex items-center justify-center shadow-md`}>
                    <span className="text-white font-black text-xs">{dept.short_name || dept.name.slice(0, 2).toUpperCase()}</span>
                </div>
                {editMode && (
                    <div className="flex items-center gap-1">
                        <button
                            disabled={disabled || indexInCategory === 0}
                            onClick={() => onMove(dept, -1)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="Move up"
                        >
                            <ArrowUp size={14} />
                        </button>
                        <button
                            disabled={disabled || indexInCategory === totalInCategory - 1}
                            onClick={() => onMove(dept, 1)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="Move down"
                        >
                            <ArrowDown size={14} />
                        </button>
                        <button
                            onClick={() => onEdit(dept)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 transition-colors"
                        >
                            <Edit2 size={14} />
                        </button>
                        <button
                            onClick={() => onDelete(dept.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            <h3 className="font-black text-[1.1rem] text-slate-800 dark:text-white mb-1 leading-tight">{dept.name}</h3>
            <p className="text-[11px] font-semibold text-violet-600 mb-2.5">{reviewTickerText(dept)}</p>
            {editMode && dept.head_name && (
                <p className="text-xs text-slate-400 mb-2.5">{dept.head_name}{dept.head_designation ? ` · ${dept.head_designation}` : ''}</p>
            )}

            {editMode && (
                <div className="mb-2.5">
                    <select
                        value={dept.category_name || 'General'}
                        onChange={(e) => onCategoryChange(dept, e.target.value)}
                        className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                        {categoryNames.map(name => <option key={name} value={name}>{name}</option>)}
                        <option value="__new__">+ New Category…</option>
                    </select>
                </div>
            )}

            <div className="grid gap-2 grid-cols-2 mt-1">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onQuickSchedule(dept);
                    }}
                    className="w-full inline-flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-violet-100 text-violet-700 font-bold text-xs hover:bg-violet-200 transition-colors"
                >
                    <CalendarPlus size={13} /> Schedule
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpen(dept.id);
                    }}
                    className={`w-full flex items-center justify-center gap-1 px-2 py-2 rounded-xl font-bold text-xs transition-colors group/btn ${editMode
                        ? 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                    Open <ArrowRight size={13} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    </motion.div>
);

const DepartmentListRow = ({
    dept,
    indexInCategory,
    totalInCategory,
    categoryNames,
    editMode,
    disabled,
    onEdit,
    onDelete,
    onOpen,
    onMove,
    onCategoryChange,
    onQuickSchedule,
}) => (
    <div className="rounded-2xl border border-indigo-100/70 bg-white/80 dark:bg-white/5 dark:border-indigo-500/20 px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div
                className={`min-w-0 flex-1 ${editMode ? '' : 'cursor-pointer'}`}
                onClick={() => {
                    if (!editMode) onOpen(dept.id);
                }}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${colorGrad[dept.color] || colorGrad.indigo} flex items-center justify-center shadow`}>
                        <span className="text-white font-black text-[10px]">{dept.short_name || dept.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <p className="font-black text-slate-800 dark:text-white truncate">{dept.name}</p>
                    {editMode && <span className="text-[11px] text-slate-400">{dept.program_count} programs</span>}
                </div>
                <p className="text-[11px] font-semibold text-violet-600 mt-1">{reviewTickerText(dept)}</p>
                {editMode && dept.head_name && <p className="text-xs text-slate-500 mt-1 truncate">{dept.head_name}{dept.head_designation ? ` · ${dept.head_designation}` : ''}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {editMode && (
                    <>
                        <select
                            value={dept.category_name || 'General'}
                            onChange={(e) => onCategoryChange(dept, e.target.value)}
                            className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        >
                            {categoryNames.map(name => <option key={name} value={name}>{name}</option>)}
                            <option value="__new__">+ New Category…</option>
                        </select>
                        <button
                            disabled={disabled || indexInCategory === 0}
                            onClick={() => onMove(dept, -1)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30"
                            title="Move up"
                        >
                            <ArrowUp size={14} />
                        </button>
                        <button
                            disabled={disabled || indexInCategory === totalInCategory - 1}
                            onClick={() => onMove(dept, 1)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30"
                            title="Move down"
                        >
                            <ArrowDown size={14} />
                        </button>
                        <button onClick={() => onEdit(dept)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
                            <Edit2 size={14} />
                        </button>
                        <button onClick={() => onDelete(dept.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                            <Trash2 size={14} />
                        </button>
                    </>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onQuickSchedule(dept);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold hover:bg-violet-200 transition-colors inline-flex items-center gap-1"
                >
                    <CalendarPlus size={12} /> Schedule
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpen(dept.id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-1"
                >
                    Open <ArrowRight size={12} />
                </button>
            </div>
        </div>
    </div>
);

const Departments = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const toast = useToast();
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editDept, setEditDept] = useState(null);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('department_view_mode') || 'grid');
    const [editMode, setEditMode] = useState(false);
    const [busy, setBusy] = useState(false);
    const [quickDept, setQuickDept] = useState(null);
    const [quickMeetingOpen, setQuickMeetingOpen] = useState(false);
    const [quickAgenda, setQuickAgenda] = useState([]);

    const groupedCategories = useMemo(() => buildCategoryBuckets(departments), [departments]);
    const categoryNames = useMemo(() => groupedCategories.map(c => c.name), [groupedCategories]);

    const load = async () => {
        setLoading(true);
        try {
            const [rows, employeeRows] = await Promise.all([
                api.getDepartments(),
                api.getEmployees(),
            ]);
            setDepartments(rows.map(normalizeDepartment));
            setEmployees(employeeRows || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        localStorage.setItem('department_view_mode', viewMode);
    }, [viewMode]);

    useEffect(() => {
        let cancelled = false;
        if (!quickMeetingOpen || !quickDept) {
            setQuickAgenda([]);
            return () => { };
        }
        (async () => {
            try {
                const rows = await api.getAgendaPoints(quickDept.id);
                if (!cancelled) setQuickAgenda(rows || []);
            } catch {
                if (!cancelled) setQuickAgenda([]);
            }
        })();
        return () => { cancelled = true; };
    }, [quickMeetingOpen, quickDept?.id]);

    const persistGroupedLayout = async (nextBuckets, successMessage) => {
        const previousDepartments = [...departments];
        const optimistic = [];
        nextBuckets.forEach((bucket, bucketIdx) => {
            bucket.departments.forEach((dept, deptIdx) => {
                optimistic.push({
                    ...dept,
                    category_name: bucket.name,
                    category_order: bucketIdx,
                    display_order: deptIdx,
                });
            });
        });

        setDepartments(optimistic);
        setBusy(true);
        try {
            const updates = [];
            nextBuckets.forEach((bucket, bucketIdx) => {
                bucket.departments.forEach((dept, deptIdx) => {
                    updates.push(
                        api.updateDepartment(dept.id, {
                            category_name: bucket.name,
                            category_order: bucketIdx,
                            display_order: deptIdx,
                        })
                    );
                });
            });
            await Promise.all(updates);
            if (successMessage) toast.success(successMessage);
        } catch (e) {
            toast.error('Failed to update arrangement');
            setDepartments(previousDepartments);
        } finally {
            setBusy(false);
        }
    };

    const handleSave = async (form) => {
        try {
            if (editDept) {
                await api.updateDepartment(editDept.id, form);
                toast.success('Department updated');
            } else {
                await api.createDepartment(form);
                toast.success('Department created');
            }
            setModalOpen(false);
            setEditDept(null);
            await load();
        } catch {
            toast.error('Error saving department');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this department and all its programs/sessions?')) return;
        try {
            await api.deleteDepartment(id);
            toast.success('Department deleted');
            await load();
        } catch {
            toast.error('Failed to delete department');
        }
    };

    const handleMoveCategory = async (categoryName, direction) => {
        const idx = groupedCategories.findIndex(c => c.name === categoryName);
        const targetIdx = idx + direction;
        if (idx < 0 || targetIdx < 0 || targetIdx >= groupedCategories.length) return;

        const next = groupedCategories.map(bucket => ({ ...bucket, departments: [...bucket.departments] }));
        const temp = next[idx];
        next[idx] = next[targetIdx];
        next[targetIdx] = temp;
        await persistGroupedLayout(next, 'Category order updated');
    };

    const handleRenameCategory = async (categoryName) => {
        const nextName = (window.prompt('Rename category', categoryName) || '').trim();
        if (!nextName || nextName === categoryName) return;
        const duplicate = groupedCategories.some(c => c.name.toLowerCase() === nextName.toLowerCase() && c.name !== categoryName);
        if (duplicate) {
            toast.error('Category already exists');
            return;
        }
        const next = groupedCategories.map(bucket => ({
            ...bucket,
            name: bucket.name === categoryName ? nextName : bucket.name,
            departments: [...bucket.departments],
        }));
        await persistGroupedLayout(next, 'Category renamed');
    };

    const handleMoveDepartment = async (dept, direction) => {
        const categoryName = dept.category_name || 'General';
        const categoryIdx = groupedCategories.findIndex(c => c.name === categoryName);
        if (categoryIdx < 0) return;

        const next = groupedCategories.map(bucket => ({ ...bucket, departments: [...bucket.departments] }));
        const bucket = next[categoryIdx];
        const deptIdx = bucket.departments.findIndex(d => d.id === dept.id);
        const targetIdx = deptIdx + direction;
        if (deptIdx < 0 || targetIdx < 0 || targetIdx >= bucket.departments.length) return;

        const temp = bucket.departments[deptIdx];
        bucket.departments[deptIdx] = bucket.departments[targetIdx];
        bucket.departments[targetIdx] = temp;
        await persistGroupedLayout(next, 'Department order updated');
    };

    const handleDepartmentCategoryChange = async (dept, nextCategoryName) => {
        let targetName = nextCategoryName;
        if (nextCategoryName === '__new__') {
            const input = (window.prompt('New category name') || '').trim();
            if (!input) return;
            targetName = input;
        }

        const currentName = dept.category_name || 'General';
        if (!targetName || targetName === currentName) return;

        const canonicalTarget = categoryNames.find(name => name.toLowerCase() === targetName.toLowerCase()) || targetName;
        const next = groupedCategories.map(bucket => ({ ...bucket, departments: [...bucket.departments] }));

        const oldIdx = next.findIndex(bucket => bucket.name === currentName);
        if (oldIdx < 0) return;
        next[oldIdx].departments = next[oldIdx].departments.filter(item => item.id !== dept.id);

        const targetIdx = next.findIndex(bucket => bucket.name.toLowerCase() === canonicalTarget.toLowerCase());
        if (targetIdx >= 0) {
            next[targetIdx].departments.push({ ...dept, category_name: canonicalTarget });
        } else {
            next.push({
                name: canonicalTarget,
                order: next.length,
                departments: [{ ...dept, category_name: canonicalTarget }],
            });
        }

        const compact = next.filter(bucket => bucket.departments.length > 0);
        await persistGroupedLayout(compact, 'Department moved to category');
    };

    const handleCreateCategory = () => {
        const nextName = (window.prompt('New category name') || '').trim();
        if (!nextName) return;
        const exists = groupedCategories.some(c => c.name.toLowerCase() === nextName.toLowerCase());
        if (exists) {
            toast.error('Category already exists');
            return;
        }
        toast.info(`Category "${nextName}" created. Assign any department to it using the Category dropdown on a card.`);
    };

    const handleQuickSchedule = async (form) => {
        if (!quickDept) return;
        try {
            await api.createMeeting(quickDept.id, {
                scheduled_date: form.scheduled_date,
                scheduled_time: form.scheduled_time || null,
                venue: form.venue || null,
                attendees: form.attendees || null,
                officer_phone: form.officer_phone || null,
            });
            toast.success('Meeting scheduled');
            setQuickMeetingOpen(false);
            setQuickDept(null);
            setQuickAgenda([]);
        } catch {
            toast.error('Failed to schedule meeting');
        }
    };

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex flex-col gap-4 mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black dark:text-white tracking-tight">Departments</h1>
                        <p className="text-slate-500 dark:text-dark-muted mt-1 font-medium">
                            Switch between card/list view, bucket by categories, and reorder categories/cards.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-xl border border-indigo-100 bg-white overflow-hidden">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <LayoutGrid size={14} /> Grid
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <List size={14} /> List
                            </button>
                        </div>
                        <button
                            onClick={() => setEditMode(v => !v)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${editMode ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                            <Edit2 size={14} /> {editMode ? 'Done Editing' : 'Edit Mode'}
                        </button>
                        {editMode && (
                            <button
                                onClick={handleCreateCategory}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-100 text-violet-700 text-xs font-bold hover:bg-violet-200 transition-colors"
                            >
                                <FolderPlus size={14} /> New Category
                            </button>
                        )}
                        <button
                            onClick={() => { setEditDept(null); setModalOpen(true); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 transition-all"
                        >
                            <Plus size={16} strokeWidth={3} /> New Department
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => <div key={i} className="glass-card rounded-3xl h-48 animate-pulse" />)}
                </div>
            ) : departments.length === 0 ? (
                <div className="glass-card rounded-3xl p-16 text-center">
                    <Building2 size={56} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-xl font-black text-slate-400">No departments yet</p>
                    <p className="text-slate-400 mt-1 mb-6">Add your first department to get started</p>
                    <button
                        onClick={() => { setEditDept(null); setModalOpen(true); }}
                        className="px-6 py-3 bg-indigo-700 text-white rounded-2xl font-bold shadow-lg"
                    >
                        <Plus size={16} className="inline mr-2" /> Add Department
                    </button>
                </div>
            ) : (
                <div className="space-y-5">
                    {groupedCategories.map((bucket, categoryIdx) => (
                        <div key={bucket.name} className="glass-card rounded-3xl p-5 border border-indigo-100/70 dark:border-indigo-500/20">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black">
                                        {bucket.name}
                                    </span>
                                    <span className="text-xs text-slate-500 font-semibold">
                                        {bucket.departments.length} department{bucket.departments.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {editMode && (
                                        <>
                                            <button
                                                disabled={busy || categoryIdx === 0}
                                                onClick={() => handleMoveCategory(bucket.name, -1)}
                                                className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30"
                                                title="Move category up"
                                            >
                                                <ArrowUp size={14} />
                                            </button>
                                            <button
                                                disabled={busy || categoryIdx === groupedCategories.length - 1}
                                                onClick={() => handleMoveCategory(bucket.name, 1)}
                                                className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30"
                                                title="Move category down"
                                            >
                                                <ArrowDown size={14} />
                                            </button>
                                            <button
                                                disabled={busy}
                                                onClick={() => handleRenameCategory(bucket.name)}
                                                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                            >
                                                Rename
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {viewMode === 'grid' ? (
                                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {bucket.departments.map((dept, idx) => (
                                        <DepartmentCard
                                            key={dept.id}
                                            dept={dept}
                                            indexInCategory={idx}
                                            totalInCategory={bucket.departments.length}
                                            categoryNames={categoryNames}
                                            editMode={editMode}
                                            disabled={busy}
                                            onEdit={(row) => { setEditDept(row); setModalOpen(true); }}
                                            onDelete={handleDelete}
                                            onOpen={(id) => navigate(`/departments/${id}`)}
                                            onMove={handleMoveDepartment}
                                            onCategoryChange={handleDepartmentCategoryChange}
                                            onQuickSchedule={(dept) => { setQuickDept(dept); setQuickMeetingOpen(true); }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {bucket.departments.map((dept, idx) => (
                                        <DepartmentListRow
                                            key={dept.id}
                                            dept={dept}
                                            indexInCategory={idx}
                                            totalInCategory={bucket.departments.length}
                                            categoryNames={categoryNames}
                                            editMode={editMode}
                                            disabled={busy}
                                            onEdit={(row) => { setEditDept(row); setModalOpen(true); }}
                                            onDelete={handleDelete}
                                            onOpen={(id) => navigate(`/departments/${id}`)}
                                            onMove={handleMoveDepartment}
                                            onCategoryChange={handleDepartmentCategoryChange}
                                            onQuickSchedule={(dept) => { setQuickDept(dept); setQuickMeetingOpen(true); }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <DeptModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditDept(null); }}
                onSave={handleSave}
                initial={editDept}
                categoryOptions={categoryNames}
            />
            <QuickScheduleModal
                department={quickDept}
                agenda={quickAgenda}
                employees={employees}
                isOpen={quickMeetingOpen}
                onClose={() => { setQuickMeetingOpen(false); setQuickDept(null); setQuickAgenda([]); }}
                onConfirm={handleQuickSchedule}
            />
        </Layout>
    );
};

export default Departments;
