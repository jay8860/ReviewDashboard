import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Plus, Trash2, X,
    Calendar, Clock, Tag, RefreshCw
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO, isSameDay } from 'date-fns';
import Layout from '../components/Layout';
import { api } from '../services/api';

const EVENT_TYPES = ['meeting', 'review', 'task', 'reminder', 'field-visit', 'other'];
const EVENT_COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet'];

const colorBg = {
    indigo: 'bg-indigo-100 border-indigo-300 text-indigo-800',
    emerald: 'bg-emerald-100 border-emerald-300 text-emerald-800',
    amber: 'bg-amber-100 border-amber-300 text-amber-800',
    rose: 'bg-rose-100 border-rose-300 text-rose-800',
    sky: 'bg-sky-100 border-sky-300 text-sky-800',
    violet: 'bg-violet-100 border-violet-300 text-violet-800',
};

const colorDot = {
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
};

const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => {
    const h = i + 7;
    return `${String(h).padStart(2, '0')}:00`;
});

// ── Event Modal ────────────────────────────────────────────────────────────────
const EventModal = ({ isOpen, onClose, onSave, initial = null, defaultDate = null }) => {
    const today = defaultDate || new Date().toISOString().split('T')[0];
    const [form, setForm] = useState({
        title: '', date: today, time_slot: '09:00',
        duration_minutes: 60, event_type: 'meeting',
        color: 'indigo', description: ''
    });

    useEffect(() => {
        if (initial) setForm({
            title: initial.title || '',
            date: initial.date || today,
            time_slot: initial.time_slot || '09:00',
            duration_minutes: initial.duration_minutes || 60,
            event_type: initial.event_type || 'meeting',
            color: initial.color || 'indigo',
            description: initial.description || ''
        });
        else setForm({ title: '', date: defaultDate || today, time_slot: '09:00', duration_minutes: 60, event_type: 'meeting', color: 'indigo', description: '' });
    }, [initial, isOpen, defaultDate]);

    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-md shadow-premium-lg">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">{initial ? 'Edit' : 'New'} Event</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={20} className="text-slate-400" /></button>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Title *</label>
                            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="Event title"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Date *</label>
                                <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Time</label>
                                <input type="time" value={form.time_slot} onChange={e => setForm({ ...form, time_slot: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Duration (min)</label>
                                <input type="number" min={15} step={15} value={form.duration_minutes}
                                    onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Type</label>
                                <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all capitalize">
                                    {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Color</label>
                            <div className="flex gap-2">
                                {EVENT_COLORS.map(c => (
                                    <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                                        className={`w-7 h-7 rounded-full ${colorDot[c]} transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-125' : 'opacity-60 hover:opacity-100'}`} />
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Description</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={2} placeholder="Optional notes..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                            <button type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20">
                                {initial ? 'Save' : 'Add Event'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const Planner = ({ user, onLogout }) => {
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editEvent, setEditEvent] = useState(null);
    const [clickedDate, setClickedDate] = useState(null);

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const start = format(weekStart, 'yyyy-MM-dd');
            const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
            const data = await api.getPlannerEvents(start, end);
            setEvents(data);
        } finally { setLoading(false); }
    }, [weekStart]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (form) => {
        try {
            if (editEvent) await api.updatePlannerEvent(editEvent.id, form);
            else await api.createPlannerEvent(form);
            setModalOpen(false);
            setEditEvent(null);
            load();
        } catch { alert('Error saving event'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this event?')) return;
        await api.deletePlannerEvent(id);
        load();
    };

    const getEventsForDay = (day) =>
        events.filter(e => isSameDay(parseISO(e.date), day))
              .sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));

    const today = new Date();

    return (
        <Layout user={user} onLogout={onLogout}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tight">Weekly Planner</h1>
                    <p className="text-slate-500 dark:text-dark-muted mt-1">
                        {format(weekStart, 'd MMM')} — {format(addDays(weekStart, 6), 'd MMM yyyy')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">
                        Today
                    </button>
                    <div className="flex gap-1">
                        <button onClick={() => setWeekStart(subWeeks(weekStart, 1))}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    {user?.role === 'admin' && (
                        <button onClick={() => { setEditEvent(null); setClickedDate(null); setModalOpen(true); }}
                            className="flex items-center gap-2 px-5 py-3 bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 transition-colors">
                            <Plus size={18} /> Add Event
                        </button>
                    )}
                    <button onClick={load} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="glass-card rounded-3xl overflow-hidden">
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-slate-100 dark:border-white/10">
                    {weekDays.map((day, i) => {
                        const isToday = isSameDay(day, today);
                        return (
                            <div key={i} className={`p-4 text-center border-r last:border-r-0 border-slate-100 dark:border-white/10 ${isToday ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                                    {format(day, 'EEE')}
                                </p>
                                <p className={`text-2xl font-black mt-1 ${isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-white'}`}>
                                    {format(day, 'd')}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Day Columns */}
                <div className="grid grid-cols-7 min-h-[60vh]">
                    {weekDays.map((day, i) => {
                        const dayEvents = getEventsForDay(day);
                        const isToday = isSameDay(day, today);
                        return (
                            <div key={i}
                                className={`border-r last:border-r-0 border-slate-100 dark:border-white/10 p-3 space-y-2 ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : ''}`}
                                onClick={() => {
                                    if (user?.role === 'admin') {
                                        setClickedDate(format(day, 'yyyy-MM-dd'));
                                        setEditEvent(null);
                                        setModalOpen(true);
                                    }
                                }}
                            >
                                {dayEvents.map(event => (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={e => e.stopPropagation()}
                                        className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer group relative ${colorBg[event.color] || colorBg.indigo}`}
                                    >
                                        <div className="flex items-start justify-between gap-1">
                                            <div className="flex-1 min-w-0">
                                                {event.time_slot && (
                                                    <p className="font-bold opacity-60 mb-0.5">{event.time_slot}</p>
                                                )}
                                                <p className="font-bold leading-tight truncate">{event.title}</p>
                                                {event.event_type && (
                                                    <p className="opacity-60 capitalize text-[10px] mt-0.5">{event.event_type}</p>
                                                )}
                                            </div>
                                            {user?.role === 'admin' && (
                                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button onClick={() => { setEditEvent(event); setModalOpen(true); }}
                                                        className="p-1 rounded-md hover:bg-white/50 transition-colors">
                                                        ✎
                                                    </button>
                                                    <button onClick={() => handleDelete(event.id)}
                                                        className="p-1 rounded-md hover:bg-white/50 transition-colors">
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {event.description && (
                                            <p className="opacity-60 text-[10px] mt-1 leading-tight line-clamp-2">{event.description}</p>
                                        )}
                                        {event.duration_minutes && event.duration_minutes !== 60 && (
                                            <p className="opacity-50 text-[10px] mt-0.5">{event.duration_minutes} min</p>
                                        )}
                                    </motion.div>
                                ))}
                                {dayEvents.length === 0 && user?.role === 'admin' && (
                                    <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <span className="text-slate-300 text-xs">+ Add</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3">
                {EVENT_TYPES.map(type => (
                    <span key={type} className="text-xs text-slate-400 capitalize flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        {type}
                    </span>
                ))}
            </div>

            <EventModal isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditEvent(null); setClickedDate(null); }}
                onSave={handleSave} initial={editEvent} defaultDate={clickedDate} />
        </Layout>
    );
};

export default Planner;
