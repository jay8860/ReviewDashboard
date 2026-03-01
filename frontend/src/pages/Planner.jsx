import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Plus, Trash2, X, RefreshCw, Settings, GripVertical,
    CalendarClock, CheckCircle2, Link2
} from 'lucide-react';
import {
    format, startOfWeek, addDays, addWeeks, subWeeks, parseISO, isSameDay, getISODay,
} from 'date-fns';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

const EVENT_TYPES = ['meeting', 'review', 'task', 'reminder', 'field-visit', 'other'];
const EVENT_COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal', 'orange'];

const statusStyles = {
    Draft: 'bg-indigo-50 border border-dashed border-indigo-200 text-indigo-700',
    Confirmed: 'bg-indigo-200 border border-indigo-300 text-indigo-900',
    Cancelled: 'bg-slate-100 border border-slate-200 text-slate-500 line-through',
};

const externalStyle = 'bg-sky-100 border border-sky-300 text-sky-900';

const colorDots = {
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
    teal: 'bg-teal-500',
    orange: 'bg-orange-500',
};

const toMinutes = (timeStr) => {
    const [h, m] = (timeStr || '00:00').split(':').map(Number);
    return (h * 60) + m;
};

const toTime = (minutes) => {
    const m = Math.max(0, Math.min(23 * 60 + 59, minutes));
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const normalizeStatus = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'confirmed') return 'Confirmed';
    if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
    return 'Draft';
};

const buildSlots = (dayStart, dayEnd, slotMinutes, gapMinutes) => {
    const slots = [];
    let cursor = toMinutes(dayStart);
    const end = toMinutes(dayEnd);
    let i = 0;
    while (cursor + slotMinutes <= end) {
        slots.push({
            index: i,
            start: toTime(cursor),
            end: toTime(cursor + slotMinutes),
            startMinutes: cursor,
            endMinutes: cursor + slotMinutes,
        });
        cursor += slotMinutes + gapMinutes;
        i += 1;
    }
    return slots;
};

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

const EventModal = ({
    isOpen,
    onClose,
    onSave,
    eventData = null,
    defaultDate,
    defaultTime,
    defaultSlotMinutes,
    departments,
}) => {
    const [form, setForm] = useState({
        title: '',
        date: defaultDate,
        time_slot: defaultTime,
        duration_minutes: defaultSlotMinutes,
        event_type: 'meeting',
        status: 'Draft',
        color: 'indigo',
        description: '',
        venue: '',
        attendees: '',
        department_id: '',
    });

    useEffect(() => {
        if (!isOpen) return;
        if (eventData) {
            setForm({
                title: eventData.title || '',
                date: eventData.date || defaultDate,
                time_slot: eventData.time_slot || defaultTime,
                duration_minutes: eventData.duration_minutes || defaultSlotMinutes,
                event_type: eventData.event_type || 'meeting',
                status: normalizeStatus(eventData.status),
                color: eventData.color || 'indigo',
                description: eventData.description || '',
                venue: eventData.venue || '',
                attendees: eventData.attendees || '',
                department_id: eventData.department_id || '',
            });
            return;
        }
        setForm({
            title: '',
            date: defaultDate,
            time_slot: defaultTime,
            duration_minutes: defaultSlotMinutes,
            event_type: 'meeting',
            status: 'Draft',
            color: 'indigo',
            description: '',
            venue: '',
            attendees: '',
            department_id: '',
        });
    }, [isOpen, eventData, defaultDate, defaultTime, defaultSlotMinutes]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-7 w-full max-w-lg shadow-premium-lg max-h-[92vh] overflow-y-auto custom-scrollbar"
                >
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">{eventData ? 'Edit Event' : 'New Event'}</h3>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">
                            <X size={18} className="text-slate-400" />
                        </button>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            onSave({
                                ...form,
                                duration_minutes: parseInt(form.duration_minutes, 10),
                                department_id: form.department_id ? parseInt(form.department_id, 10) : null,
                            });
                        }}
                        className="space-y-4"
                    >
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Title *</label>
                            <input
                                required
                                value={form.title}
                                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Event title"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Date</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Time</label>
                                <input
                                    type="time"
                                    value={form.time_slot}
                                    onChange={e => setForm(prev => ({ ...prev, time_slot: e.target.value }))}
                                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Duration</label>
                                <select
                                    value={form.duration_minutes}
                                    onChange={e => setForm(prev => ({ ...prev, duration_minutes: e.target.value }))}
                                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                >
                                    <option value={30}>30m</option>
                                    <option value={60}>60m</option>
                                    <option value={90}>90m</option>
                                    <option value={120}>120m</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Type</label>
                                <select
                                    value={form.event_type}
                                    onChange={e => setForm(prev => ({ ...prev, event_type: e.target.value }))}
                                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 capitalize"
                                >
                                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Status</label>
                                <select
                                    value={form.status}
                                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                >
                                    <option value="Draft">Draft</option>
                                    <option value="Confirmed">Confirmed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Color</label>
                                <div className="flex items-center gap-1 mt-1">
                                    {EVENT_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setForm(prev => ({ ...prev, color: c }))}
                                            className={`w-6 h-6 rounded-full ${colorDots[c]} ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-60 hover:opacity-100'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Department (optional)</label>
                                <select
                                    value={form.department_id}
                                    onChange={e => setForm(prev => ({ ...prev, department_id: e.target.value }))}
                                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                >
                                    <option value="">None</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Venue</label>
                                <input
                                    value={form.venue}
                                    onChange={e => setForm(prev => ({ ...prev, venue: e.target.value }))}
                                    placeholder="Meeting room"
                                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Attendees</label>
                            <input
                                value={form.attendees}
                                onChange={e => setForm(prev => ({ ...prev, attendees: e.target.value }))}
                                placeholder="Comma separated names"
                                className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Description / Notes</label>
                            <textarea
                                rows={3}
                                value={form.description}
                                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Notes, agenda, comments..."
                                className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                            />
                        </div>
                        {form.event_type === 'meeting' && form.department_id && (
                            <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 text-xs text-violet-700 font-semibold">
                                Confirmed department meetings auto-create Meeting Workspace entries.
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
                                Cancel
                            </button>
                            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                                Save Event
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const Planner = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const toast = useToast();

    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [events, setEvents] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [settings, setSettings] = useState(null);
    const [settingsDraft, setSettingsDraft] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editEvent, setEditEvent] = useState(null);
    const [clickedDate, setClickedDate] = useState(null);
    const [clickedTime, setClickedTime] = useState(null);
    const [dragEventId, setDragEventId] = useState(null);

    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
    const today = new Date();

    const slots = useMemo(() => {
        if (!settings) return [];
        return buildSlots(
            settings.day_start || '10:00',
            settings.day_end || '18:00',
            settings.slot_minutes || 30,
            settings.slot_gap_minutes ?? 15
        );
    }, [settings]);

    const recurringBlocks = useMemo(() => settings?.recurring_blocks || [], [settings]);

    const loadSettings = useCallback(async () => {
        const cfg = await api.getPlannerSettings();
        setSettings(cfg);
        setSettingsDraft(cfg);
    }, []);

    const loadDepartments = useCallback(async () => {
        const rows = await api.getDepartments();
        setDepartments(rows || []);
    }, []);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        try {
            const start = format(weekStart, 'yyyy-MM-dd');
            const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
            if (settings?.apple_ics_url) {
                try {
                    await api.syncPlannerIcs({ start_date: start, end_date: end });
                } catch (e) {
                    console.warn('ICS sync skipped:', e);
                }
            }
            const data = await api.getPlannerEvents(start, end);
            setEvents(data || []);
        } finally {
            setLoading(false);
        }
    }, [weekStart, settings?.apple_ics_url]);

    useEffect(() => {
        Promise.all([loadSettings(), loadDepartments()]);
    }, [loadSettings, loadDepartments]);

    useEffect(() => {
        if (!settings) return;
        loadEvents();
    }, [settings, loadEvents]);

    const saveSettings = async () => {
        try {
            const payload = {
                ...settingsDraft,
                slot_minutes: parseInt(settingsDraft.slot_minutes, 10),
                slot_gap_minutes: parseInt(settingsDraft.slot_gap_minutes, 10),
            };
            const saved = await api.updatePlannerSettings(payload);
            setSettings(saved);
            setSettingsDraft(saved);
            toast.success('Planner settings saved');
        } catch {
            toast.error('Failed to save planner settings');
        }
    };

    const manualSync = async () => {
        try {
            const start = format(weekStart, 'yyyy-MM-dd');
            const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
            const result = await api.syncPlannerIcs({ start_date: start, end_date: end });
            toast.success(`ICS synced: +${result.created}, updated ${result.updated}`);
            loadEvents();
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'ICS sync failed');
        }
    };

    const handleSaveEvent = async (payload) => {
        try {
            if (editEvent) {
                await api.updatePlannerEvent(editEvent.id, payload);
            } else {
                await api.createPlannerEvent(payload);
            }
            setModalOpen(false);
            setEditEvent(null);
            setClickedDate(null);
            setClickedTime(null);
            await loadEvents();
            toast.success('Event saved');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to save event');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this event?')) return;
        try {
            await api.deletePlannerEvent(id);
            await loadEvents();
            toast.success('Event deleted');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to delete event');
        }
    };

    const handleDropEvent = async (eventId, dateStr, timeSlot) => {
        if (!eventId) return;
        const event = events.find(e => e.id === eventId);
        if (!event || event.is_locked) return;
        try {
            await api.updatePlannerEvent(eventId, { date: dateStr, time_slot: timeSlot });
            await loadEvents();
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to move event');
        }
    };

    const handleConfirmDraft = async (event) => {
        try {
            await api.updatePlannerEvent(event.id, { status: 'Confirmed' });
            await loadEvents();
            toast.success('Event confirmed');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to confirm event');
        }
    };

    const getDayEvents = (day) =>
        events
            .filter(e => isSameDay(parseISO(e.date), day))
            .sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));

    const isLunchBlocked = (slot) => {
        if (!settings?.lunch_start || !settings?.lunch_end) return false;
        return overlaps(
            slot.startMinutes,
            slot.endMinutes,
            toMinutes(settings.lunch_start),
            toMinutes(settings.lunch_end)
        );
    };

    const getRecurringBlockAtSlot = (day, slot) => {
        const dayIso = getISODay(day);
        for (const block of recurringBlocks) {
            const days = Array.isArray(block.days) ? block.days : [];
            if (!days.includes(dayIso)) continue;
            if (overlaps(slot.startMinutes, slot.endMinutes, toMinutes(block.start), toMinutes(block.end))) {
                return block;
            }
        }
        return null;
    };

    if (!settings) {
        return (
            <Layout user={user} onLogout={onLogout}>
                <div className="flex items-center justify-center h-64 text-slate-400">
                    <RefreshCw size={24} className="animate-spin mr-2" /> Loading planner...
                </div>
            </Layout>
        );
    }

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex flex-col gap-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-4xl font-black dark:text-white tracking-tight">Weekly Planner</h1>
                        <p className="text-slate-500 mt-1">
                            {format(weekStart, 'd MMM')} — {format(addDays(weekStart, 6), 'd MMM yyyy')} · 30 min slots · 15 min breaks
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                            className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200"
                        >
                            Today
                        </button>
                        <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500"><ChevronLeft size={18} /></button>
                        <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500"><ChevronRight size={18} /></button>
                        <button onClick={manualSync} className="px-4 py-2 rounded-xl bg-sky-100 text-sky-700 text-sm font-bold hover:bg-sky-200 inline-flex items-center gap-1.5">
                            <Link2 size={14} /> Sync ICS
                        </button>
                        <button onClick={loadEvents} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={() => setShowSettings(v => !v)} className="px-4 py-2 rounded-xl bg-violet-100 text-violet-700 text-sm font-bold hover:bg-violet-200 inline-flex items-center gap-1.5">
                            <Settings size={14} /> Settings
                        </button>
                        <button
                            onClick={() => {
                                setEditEvent(null);
                                setClickedDate(format(new Date(), 'yyyy-MM-dd'));
                                setClickedTime(settings.day_start || '10:00');
                                setModalOpen(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 inline-flex items-center gap-1.5"
                        >
                            <Plus size={14} /> Add Event
                        </button>
                    </div>
                </div>

                {showSettings && (
                    <div className="glass-card rounded-2xl p-4 border border-indigo-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wide text-slate-400 block mb-1">Day Start</label>
                                <input type="time" value={settingsDraft.day_start || '10:00'} onChange={e => setSettingsDraft(prev => ({ ...prev, day_start: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm" />
                            </div>
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wide text-slate-400 block mb-1">Day End</label>
                                <input type="time" value={settingsDraft.day_end || '18:00'} onChange={e => setSettingsDraft(prev => ({ ...prev, day_end: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm" />
                            </div>
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wide text-slate-400 block mb-1">Slot (min)</label>
                                <input type="number" min={15} step={15} value={settingsDraft.slot_minutes || 30} onChange={e => setSettingsDraft(prev => ({ ...prev, slot_minutes: parseInt(e.target.value, 10) || 30 }))} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm" />
                            </div>
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wide text-slate-400 block mb-1">Gap (min)</label>
                                <input type="number" min={0} step={5} value={settingsDraft.slot_gap_minutes ?? 15} onChange={e => setSettingsDraft(prev => ({ ...prev, slot_gap_minutes: parseInt(e.target.value, 10) || 0 }))} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm" />
                            </div>
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wide text-slate-400 block mb-1">Lunch Start</label>
                                <input type="time" value={settingsDraft.lunch_start || '13:30'} onChange={e => setSettingsDraft(prev => ({ ...prev, lunch_start: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm" />
                            </div>
                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wide text-slate-400 block mb-1">Lunch End</label>
                                <input type="time" value={settingsDraft.lunch_end || '14:30'} onChange={e => setSettingsDraft(prev => ({ ...prev, lunch_end: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm" />
                            </div>
                            <div className="md:col-span-2 xl:col-span-2">
                                <label className="text-[11px] font-black uppercase tracking-wide text-slate-400 block mb-1">Apple ICS URL</label>
                                <input value={settingsDraft.apple_ics_url || ''} onChange={e => setSettingsDraft(prev => ({ ...prev, apple_ics_url: e.target.value }))} placeholder="https://.../calendar.ics" className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm" />
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button onClick={saveSettings} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">Save Settings</button>
                            <span className="text-xs text-slate-500">Default: 10:00-18:00, 30 min slots, 15 min break, lunch 13:30-14:30.</span>
                        </div>
                    </div>
                )}

                <div className="glass-card rounded-3xl overflow-auto">
                    <div className="grid grid-cols-7 border-b border-slate-100">
                        {weekDays.map((day, i) => {
                            const isToday = isSameDay(day, today);
                            return (
                                <div key={i} className={`p-3 text-center border-r last:border-r-0 border-slate-100 ${isToday ? 'bg-indigo-50' : ''}`}>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{format(day, 'EEE')}</p>
                                    <p className={`text-xl font-black mt-0.5 ${isToday ? 'text-indigo-700' : 'text-slate-700'}`}>{format(day, 'd')}</p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-7 min-w-[980px]">
                        {weekDays.map((day, dayIdx) => {
                            const dayEvents = getDayEvents(day);
                            const eventByTime = new Map();
                            const unslotted = [];
                            dayEvents.forEach(evt => {
                                if (slots.some(s => s.start === evt.time_slot)) eventByTime.set(evt.time_slot, evt);
                                else unslotted.push(evt);
                            });
                            const dayStr = format(day, 'yyyy-MM-dd');

                            return (
                                <div key={dayIdx} className="border-r last:border-r-0 border-slate-100 p-2">
                                    <div className="space-y-1.5">
                                        {slots.map((slot, slotIdx) => {
                                            const event = eventByTime.get(slot.start);
                                            const lunchBlocked = isLunchBlocked(slot);
                                            const recurringBlock = getRecurringBlockAtSlot(day, slot);
                                            const blockedLabel = lunchBlocked
                                                ? 'Lunch Break'
                                                : recurringBlock
                                                    ? recurringBlock.name
                                                    : null;

                                            return (
                                                <React.Fragment key={`${dayStr}-${slot.start}`}>
                                                    <div
                                                        className={`rounded-xl border px-2 py-2 min-h-[56px] transition-colors ${blockedLabel ? 'bg-slate-50 border-slate-200' : 'bg-white border-indigo-100 hover:border-indigo-300'}`}
                                                        onClick={() => {
                                                            if (blockedLabel || event) return;
                                                            setEditEvent(null);
                                                            setClickedDate(dayStr);
                                                            setClickedTime(slot.start);
                                                            setModalOpen(true);
                                                        }}
                                                        onDragOver={(e) => {
                                                            if (blockedLabel) return;
                                                            e.preventDefault();
                                                        }}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            if (blockedLabel) return;
                                                            const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                                            handleDropEvent(draggedId, dayStr, slot.start);
                                                            setDragEventId(null);
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-[10px] font-black text-slate-400">{slot.start} - {slot.end}</p>
                                                            {!event && !blockedLabel && <span className="text-[10px] text-slate-300">Draft Slot</span>}
                                                        </div>

                                                        {blockedLabel && !event && (
                                                            <p className="text-[11px] font-semibold text-slate-500">{blockedLabel}</p>
                                                        )}

                                                        {event && (
                                                            <motion.div
                                                                layout
                                                                draggable={!event.is_locked}
                                                                onDragStart={(e) => {
                                                                    if (event.is_locked) return;
                                                                    setDragEventId(event.id);
                                                                    e.dataTransfer.setData('text/plain', String(event.id));
                                                                }}
                                                                className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold cursor-pointer ${event.is_locked ? externalStyle : statusStyles[normalizeStatus(event.status)] || statusStyles.Draft} ${dragEventId === event.id ? 'opacity-50' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditEvent(event);
                                                                    setModalOpen(true);
                                                                }}
                                                            >
                                                                <div className="flex items-start gap-1">
                                                                    {!event.is_locked && <GripVertical size={12} className="mt-0.5 opacity-60" />}
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-black truncate">{event.title}</p>
                                                                        <p className="text-[10px] opacity-70 capitalize">{event.event_type} · {normalizeStatus(event.status)}</p>
                                                                        {event.department_name && (
                                                                            <p className="text-[10px] opacity-70 truncate">{event.department_name}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                                    {!event.is_locked && normalizeStatus(event.status) === 'Draft' && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleConfirmDraft(event); }}
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-bold"
                                                                        >
                                                                            <CheckCircle2 size={10} /> Confirm
                                                                        </button>
                                                                    )}
                                                                    {event.department_meeting_id && event.department_id && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                navigate(`/departments/${event.department_id}/meetings/${event.department_meeting_id}`);
                                                                            }}
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-600 text-white text-[10px] font-bold"
                                                                        >
                                                                            <CalendarClock size={10} /> Workspace
                                                                        </button>
                                                                    )}
                                                                    {!event.is_locked && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-bold"
                                                                        >
                                                                            <Trash2 size={10} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                    {slotIdx < slots.length - 1 && (settings.slot_gap_minutes ?? 15) > 0 && (
                                                        <div className="h-4 flex items-center justify-center">
                                                            <span className="text-[9px] uppercase tracking-wide text-slate-300">
                                                                {(settings.slot_gap_minutes ?? 15)}m break
                                                            </span>
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                    {unslotted.length > 0 && (
                                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Outside Slots</p>
                                            <div className="space-y-1">
                                                {unslotted.map(evt => (
                                                    <div key={evt.id} className="text-[11px] text-slate-600 font-semibold">
                                                        {evt.time_slot || '—'} {evt.title}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <EventModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditEvent(null); }}
                onSave={handleSaveEvent}
                eventData={editEvent}
                defaultDate={clickedDate || format(new Date(), 'yyyy-MM-dd')}
                defaultTime={clickedTime || settings.day_start || '10:00'}
                defaultSlotMinutes={settings.slot_minutes || 30}
                departments={departments}
            />
        </Layout>
    );
};

export default Planner;
