import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, ExternalLink, MapPin, Plus, Trash2, ArrowUp, ArrowDown,
    Save, Sparkles, Route, FileText, Users, Search, Clock, ClipboardCheck,
    CheckCircle2, Circle, Filter, RotateCcw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

const WAIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const isStenoEmployee = (emp) => {
    const haystack = `${emp?.name || ''} ${emp?.display_username || ''}`.toLowerCase();
    return haystack.includes('steno') || haystack.includes('secretary');
};

const cleanText = (value) => (value || '').replace(/\s+/g, ' ').trim();

const getTodayInputValue = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toDisplayDate = (value) => {
    if (!value) return 'No date';
    const parsed = parseISO(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString();
};

const firstPlaceFromVisitNote = (note) => {
    const raw = (note || '').split('\n').map(line => line.trim()).find(Boolean);
    if (!raw) return '';
    return raw.replace(/^\d+[.)-]\s*/, '').split('—')[0].trim();
};

const buildMapSearchLink = (query) => {
    const q = cleanText(query);
    if (!q) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

const buildMapEmbedLink = (query) => {
    const q = cleanText(query);
    if (!q) return null;
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
};

const compactPlaceLines = (value, maxLines = 6) => {
    return String(value || '')
        .split('\n')
        .map(line => cleanText(line.replace(/^\d+[.)-]\s*/, '').replace(/^[-*•\u2022]\s*/, '')))
        .filter(Boolean)
        .slice(0, maxLines);
};

const parseNotepadLines = (text) => {
    return (text || '')
        .split('\n')
        .map((line, idx) => ({
            line_no: idx + 1,
            title: cleanText(line.replace(/^[-*•\u2022]\s*/, '')),
        }))
        .filter(item => item.title)
        .map(item => {
            const parts = item.title.split('|').map(p => cleanText(p));
            const location = parts.length > 1 ? parts[0] : '';
            const details = parts.length > 1 ? cleanText(parts.slice(1).join(' | ')) : item.title;
            return {
                ...item,
                location,
                details,
                map_link: buildMapSearchLink(location || details),
            };
        });
};

const buildFieldVisitMessage = ({
    title,
    date,
    time,
    duration,
    departmentName,
    visitPlaces,
    peopleGoing,
}) => {
    const dateText = date ? format(parseISO(date), 'd MMMM yyyy') : 'TBD';
    const deptLine = departmentName ? `\nDepartment: ${departmentName}` : '';
    const placeLines = compactPlaceLines(visitPlaces);
    const team = cleanText(peopleGoing);
    const placesLine = placeLines.length
        ? `\nVisit places:\n${placeLines.map((line, idx) => `${idx + 1}. ${line}`).join('\n')}`
        : '';
    const teamLine = team ? `\nTeam: ${team}` : '';

    return `Field Visit Scheduled\nVisit: ${cleanText(title) || 'Field Visit'}\nDate: ${dateText}\nTime: ${time || 'TBD'}\nDuration: ${duration || 120} min${deptLine}${placesLine}${teamLine}`;
};

const ScheduleVisitModal = ({
    isOpen,
    onClose,
    onFinalize,
    initialData,
    departments,
    employees,
    saving,
}) => {
    const [form, setForm] = useState({
        title: '',
        date: getTodayInputValue(),
        time_slot: '10:00',
        duration_minutes: 120,
        department_id: '',
        visit_places_note: '',
        people_going: '',
    });
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
    const [includeStenoCopy, setIncludeStenoCopy] = useState(true);
    const selectedEmployeeNames = useMemo(() => {
        const employeeMap = new Map((employees || []).map(emp => [emp.id, emp]));
        return (selectedEmployeeIds || [])
            .map(id => employeeMap.get(id)?.name)
            .filter(Boolean);
    }, [selectedEmployeeIds, employees]);

    useEffect(() => {
        if (!isOpen) return;
        const payload = {
            title: initialData?.title || '',
            date: initialData?.date || getTodayInputValue(),
            time_slot: initialData?.time_slot || '10:00',
            duration_minutes: initialData?.duration_minutes || 120,
            department_id: initialData?.department_id || '',
            visit_places_note: initialData?.visit_places_note || '',
            people_going: initialData?.people_going || '',
        };
        setForm(payload);
        const deptName = departments.find(d => String(d.id) === String(payload.department_id))?.name || '';
        setMessage(buildFieldVisitMessage({
            title: payload.title,
            date: payload.date,
            time: payload.time_slot,
            duration: payload.duration_minutes,
            departmentName: deptName,
            visitPlaces: payload.visit_places_note,
            peopleGoing: payload.people_going,
        }));

        const attendeeTokens = String(payload.people_going || '')
            .split(',')
            .map(token => token.trim().toLowerCase())
            .filter(Boolean);
        const preselected = [];
        if (attendeeTokens.length) {
            employees.forEach(emp => {
                const name = (emp.name || '').toLowerCase();
                if (attendeeTokens.some(token => name.includes(token))) {
                    preselected.push(emp.id);
                }
            });
        }
        setSelectedEmployeeIds(preselected);
        setIncludeStenoCopy(employees.some(isStenoEmployee));
        setSearchTerm('');
    }, [isOpen, initialData, departments, employees]);

    useEffect(() => {
        if (!isOpen) return;
        const current = cleanText(form.people_going);
        if (current) return;
        if (!selectedEmployeeNames.length) return;
        setForm(prev => ({ ...prev, people_going: selectedEmployeeNames.join(', ') }));
    }, [selectedEmployeeNames, isOpen, form.people_going]);

    useEffect(() => {
        if (!isOpen) return;
        const deptName = departments.find(d => String(d.id) === String(form.department_id))?.name || '';
        const teamPeople = cleanText(form.people_going) || selectedEmployeeNames.join(', ');
        setMessage(buildFieldVisitMessage({
            title: form.title,
            date: form.date,
            time: form.time_slot,
            duration: form.duration_minutes,
            departmentName: deptName,
            visitPlaces: form.visit_places_note,
            peopleGoing: teamPeople,
        }));
    }, [form.title, form.date, form.time_slot, form.duration_minutes, form.department_id, form.visit_places_note, form.people_going, selectedEmployeeNames, departments, isOpen]);

    if (!isOpen) return null;

    const visibleEmployees = employees.filter(emp => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            (emp.name || '').toLowerCase().includes(q)
            || (emp.display_username || '').toLowerCase().includes(q)
            || (emp.mobile_number || '').toLowerCase().includes(q)
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

    const buildRecipients = () => {
        const map = new Map(employees.map(emp => [emp.id, emp]));
        const numbers = [];
        selectedEmployeeIds.forEach(id => {
            const value = map.get(id)?.mobile_number;
            if (value) numbers.push(value);
        });
        if (includeStenoCopy) {
            stenoEmployees.forEach(emp => {
                if (emp.mobile_number) numbers.push(emp.mobile_number);
            });
        }
        return [...new Set(numbers.map(v => String(v || '').replace(/\D/g, '')).filter(Boolean))];
    };

    const submit = () => {
        if (!cleanText(form.title)) {
            window.alert('Visit name is required');
            return;
        }
        if (!cleanText(form.visit_places_note)) {
            window.alert('Visit places notepad is required');
            return;
        }
        const recipients = buildRecipients();
        if (!recipients.length) {
            window.alert('Select at least one recipient');
            return;
        }
        onFinalize({ form, message, recipients });
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="glass-card rounded-3xl w-full max-w-5xl shadow-premium-lg max-h-[92vh] overflow-y-auto custom-scrollbar">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-800">Finalize Field Visit</h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><Plus className="w-4 h-4 rotate-45" /></button>
                </div>

                <div className="p-6 grid lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                value={form.title}
                                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Visit name"
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                            />
                            <select
                                value={form.department_id}
                                onChange={(e) => setForm(prev => ({ ...prev, department_id: e.target.value }))}
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                            >
                                <option value="">No specific department</option>
                                {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                            />
                            <input
                                type="time"
                                value={form.time_slot}
                                onChange={(e) => setForm(prev => ({ ...prev, time_slot: e.target.value }))}
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                            />
                            <input
                                type="number"
                                min={30}
                                step={15}
                                value={form.duration_minutes}
                                onChange={(e) => setForm(prev => ({ ...prev, duration_minutes: parseInt(e.target.value, 10) || 120 }))}
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                                placeholder="Duration"
                            />
                        </div>

                        <textarea
                            rows={6}
                            value={form.visit_places_note}
                            onChange={(e) => setForm(prev => ({ ...prev, visit_places_note: e.target.value }))}
                            placeholder="Visit places notepad"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white resize-none"
                        />

                        <input
                            value={form.people_going}
                            onChange={(e) => setForm(prev => ({ ...prev, people_going: e.target.value }))}
                            placeholder="People who will go along (comma separated names)"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                        />

                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Recipients</p>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 mb-2">
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
                            <div className="max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
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
                                            <p className="text-[11px] text-slate-400 truncate">{emp.mobile_number}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 mt-2">
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
                    </div>

                    <div className="space-y-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Concise WhatsApp Message (Editable)</p>
                        <textarea
                            rows={22}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full text-sm px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                        />
                    </div>
                </div>

                <div className="px-6 pb-6 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 inline-flex items-center gap-2 disabled:opacity-60"
                    >
                        <WAIcon /> {saving ? 'Finalizing...' : 'Finalize + Send'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EMPTY_COVERAGE = {
    summary: {
        total_gps: 0,
        visited_gps: 0,
        never_visited_gps: 0,
        recent_gps: 0,
        stale_gps: 0,
        coverage_pct: 0,
    },
    blocks: [],
    gram_panchayats: [],
};

const COVERAGE_STATUS_META = {
    recent: {
        label: 'Recent',
        fill: '#059669',
        dot: 'bg-emerald-600',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    visited: {
        label: 'Visited',
        fill: '#2563eb',
        dot: 'bg-blue-600',
        chip: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    stale: {
        label: 'Old visit',
        fill: '#f97316',
        dot: 'bg-orange-500',
        chip: 'bg-orange-50 text-orange-700 border-orange-200',
    },
    never: {
        label: 'Pending',
        fill: '#e11d48',
        dot: 'bg-rose-600',
        chip: 'bg-rose-50 text-rose-700 border-rose-200',
    },
};

const COVERAGE_BLOCK_LAYOUTS = {
    Dantewada: { x: 8, y: 8, w: 38, h: 26 },
    Geedam: { x: 50, y: 8, w: 42, h: 30 },
    Katekalyan: { x: 8, y: 39, w: 38, h: 27 },
    Kuakonda: { x: 50, y: 43, w: 42, h: 23 },
};

const fallbackBlockLayout = { x: 8, y: 8, w: 84, h: 58 };

const getCoverageStatusMeta = (status) => COVERAGE_STATUS_META[status] || COVERAGE_STATUS_META.never;

const buildCoverageMapPoints = (rows) => {
    const groups = rows.reduce((acc, row) => {
        const block = row.block || 'Unassigned';
        if (!acc[block]) acc[block] = [];
        acc[block].push(row);
        return acc;
    }, {});

    const points = [];
    Object.entries(groups).forEach(([block, items]) => {
        const layout = COVERAGE_BLOCK_LAYOUTS[block] || fallbackBlockLayout;
        const columns = Math.max(4, Math.ceil(Math.sqrt(items.length * (layout.w / Math.max(layout.h, 1)))));
        const rowsCount = Math.max(1, Math.ceil(items.length / columns));
        items.forEach((item, idx) => {
            const col = idx % columns;
            const row = Math.floor(idx / columns);
            points.push({
                ...item,
                map_x: layout.x + ((col + 0.5) * layout.w) / columns,
                map_y: layout.y + ((row + 0.72) * layout.h) / rowsCount,
            });
        });
    });
    return points;
};

const formatLastVisit = (row) => {
    if (!row?.last_visit_date) return 'Never visited';
    const dateText = toDisplayDate(row.last_visit_date);
    if (row.days_since_last_visit === 0) return `${dateText} - today`;
    if (row.days_since_last_visit === 1) return `${dateText} - 1 day ago`;
    return `${dateText} - ${row.days_since_last_visit} days ago`;
};

const FieldVisitCoveragePanel = ({
    coverage,
    selectedGpIds,
    setSelectedGpIds,
    filters,
    setFilters,
    visitDate,
    setVisitDate,
    visitNotes,
    setVisitNotes,
    marking,
    onMarkVisited,
}) => {
    const data = coverage || EMPTY_COVERAGE;
    const allRows = data.gram_panchayats || [];
    const selectedSet = useMemo(() => new Set(selectedGpIds), [selectedGpIds]);
    const visibleRows = useMemo(() => {
        const q = (filters.search || '').trim().toLowerCase();
        return allRows.filter(row => {
            const blockMatch = filters.block === 'all' || row.block === filters.block;
            const statusMatch = filters.status === 'all' || row.status === filters.status;
            const searchMatch = !q || `${row.name} ${row.block} ${row.sample_villages || ''}`.toLowerCase().includes(q);
            return blockMatch && statusMatch && searchMatch;
        });
    }, [allRows, filters]);
    const mapPoints = useMemo(() => buildCoverageMapPoints(allRows), [allRows]);
    const pendingRows = useMemo(() => (
        allRows
            .filter(row => row.status === 'never' || row.status === 'stale')
            .sort((a, b) => {
                if (a.status !== b.status) return a.status === 'never' ? -1 : 1;
                return (b.days_since_last_visit || 99999) - (a.days_since_last_visit || 99999);
            })
            .slice(0, 8)
    ), [allRows]);

    const toggleGp = (id) => {
        setSelectedGpIds(prev => (
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        ));
    };

    const selectVisible = (mode = 'all') => {
        const ids = visibleRows
            .filter(row => mode === 'all' || row.status === 'never' || row.status === 'stale')
            .map(row => row.id);
        setSelectedGpIds(prev => [...new Set([...prev, ...ids])]);
    };

    const clearSelection = () => setSelectedGpIds([]);

    return (
        <div className="glass-card rounded-3xl p-5 border border-emerald-100 order-1">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-5">
                <div>
                    <div className="flex items-center gap-2">
                        <MapPin size={17} className="text-emerald-600" />
                        <h2 className="font-black text-slate-800 dark:text-white">GP Visit Coverage</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        {data.summary.total_gps || 0} Gram Panchayats across {(data.blocks || []).length} blocks.
                    </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 min-w-0 xl:min-w-[520px]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] uppercase tracking-widest font-black text-slate-400">Coverage</p>
                        <p className="text-2xl font-black text-slate-800">{data.summary.coverage_pct || 0}%</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-[11px] uppercase tracking-widest font-black text-emerald-600">Visited</p>
                        <p className="text-2xl font-black text-emerald-700">{data.summary.visited_gps || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                        <p className="text-[11px] uppercase tracking-widest font-black text-rose-600">Pending</p>
                        <p className="text-2xl font-black text-rose-700">{data.summary.never_visited_gps || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
                        <p className="text-[11px] uppercase tracking-widest font-black text-orange-600">90+ days</p>
                        <p className="text-2xl font-black text-orange-700">{data.summary.stale_gps || 0}</p>
                    </div>
                </div>
            </div>

            <div className="grid xl:grid-cols-[1.08fr_0.92fr] gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-sm font-black text-slate-800">Coverage Map</h3>
                        <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-bold text-slate-500">
                            {Object.entries(COVERAGE_STATUS_META).map(([key, meta]) => (
                                <span key={key} className="inline-flex items-center gap-1">
                                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                                    {meta.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <svg viewBox="0 0 100 72" role="img" aria-label="Gram Panchayat visit coverage map" className="w-full aspect-[1.55] rounded-2xl bg-slate-50 border border-slate-100">
                        <rect x="2" y="2" width="96" height="68" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
                        {Object.entries(COVERAGE_BLOCK_LAYOUTS).map(([block, layout]) => (
                            <g key={block}>
                                <rect x={layout.x} y={layout.y} width={layout.w} height={layout.h} rx="2.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.35" />
                                <text x={layout.x + 2} y={layout.y + 4.2} fill="#64748b" fontSize="2.4" fontWeight="700">{block}</text>
                            </g>
                        ))}
                        {mapPoints.map(point => {
                            const meta = getCoverageStatusMeta(point.status);
                            const selected = selectedSet.has(point.id);
                            return (
                                <circle
                                    key={point.id}
                                    cx={point.map_x}
                                    cy={point.map_y}
                                    r={selected ? 1.35 : 0.95}
                                    fill={meta.fill}
                                    stroke={selected ? '#111827' : '#ffffff'}
                                    strokeWidth={selected ? 0.42 : 0.28}
                                    className="cursor-pointer"
                                    onClick={() => toggleGp(point.id)}
                                >
                                    <title>{`${point.name}, ${point.block} - ${point.status_label}`}</title>
                                </circle>
                            );
                        })}
                    </svg>

                    <div className="grid md:grid-cols-4 gap-2 mt-3">
                        {(data.blocks || []).map(block => (
                            <div key={block.block} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                <p className="text-xs font-black text-slate-700 truncate">{block.block}</p>
                                <p className="text-[11px] text-slate-500">{block.visited}/{block.total} visited</p>
                                <div className="mt-1 h-1.5 rounded-full bg-white overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${block.coverage_pct || 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-black text-slate-800">Mark Visits</h3>
                        <span className="text-xs font-bold text-slate-500">{selectedGpIds.length} selected</span>
                    </div>

                    <div className="grid md:grid-cols-3 gap-2 mb-3">
                        <div className="rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2 md:col-span-1">
                            <Search size={14} className="text-slate-400" />
                            <input
                                value={filters.search}
                                onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                placeholder="Search GP"
                                className="w-full text-sm bg-transparent text-slate-700 focus:outline-none"
                            />
                        </div>
                        <select
                            value={filters.block}
                            onChange={e => setFilters(prev => ({ ...prev, block: e.target.value }))}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700"
                        >
                            <option value="all">All blocks</option>
                            {(data.blocks || []).map(block => <option key={block.block} value={block.block}>{block.block}</option>)}
                        </select>
                        <select
                            value={filters.status}
                            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700"
                        >
                            <option value="all">All status</option>
                            <option value="never">Pending</option>
                            <option value="stale">90+ days</option>
                            <option value="visited">Visited</option>
                            <option value="recent">Recent</option>
                        </select>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                        <button
                            onClick={() => selectVisible('pending')}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 text-xs font-bold inline-flex items-center gap-1"
                        >
                            <Filter size={12} /> Select pending visible
                        </button>
                        <button
                            onClick={() => selectVisible('all')}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white text-xs font-bold inline-flex items-center gap-1"
                        >
                            <CheckCircle2 size={12} /> Select visible
                        </button>
                        <button
                            onClick={clearSelection}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white text-xs font-bold inline-flex items-center gap-1"
                        >
                            <RotateCcw size={12} /> Clear
                        </button>
                    </div>

                    <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 divide-y divide-slate-100 custom-scrollbar">
                        {visibleRows.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-slate-400 italic">No Gram Panchayat matches this filter.</p>
                        ) : visibleRows.map(row => {
                            const meta = getCoverageStatusMeta(row.status);
                            const selected = selectedSet.has(row.id);
                            return (
                                <label key={row.id} className="px-3 py-2.5 flex items-start gap-2 hover:bg-slate-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => toggleGp(row.id)}
                                        className="mt-1 w-4 h-4 accent-emerald-600"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <p className="text-sm font-black text-slate-800 truncate">{row.name}</p>
                                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black whitespace-nowrap ${meta.chip}`}>
                                                {meta.label}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate">{row.block} | {formatLastVisit(row)}</p>
                                        {row.sample_villages && <p className="text-[11px] text-slate-400 truncate">Villages: {row.sample_villages}</p>}
                                    </div>
                                </label>
                            );
                        })}
                    </div>

                    <div className="grid md:grid-cols-[150px_1fr] gap-2 mt-3">
                        <input
                            type="date"
                            value={visitDate}
                            onChange={e => setVisitDate(e.target.value)}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800"
                        />
                        <input
                            value={visitNotes}
                            onChange={e => setVisitNotes(e.target.value)}
                            placeholder="Notes"
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800"
                        />
                    </div>
                    <button
                        onClick={onMarkVisited}
                        disabled={marking || selectedGpIds.length === 0}
                        className="mt-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        <ClipboardCheck size={15} /> {marking ? 'Saving...' : `Mark ${selectedGpIds.length || ''} Visited`}
                    </button>

                    <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Next Attention</p>
                        <div className="grid gap-1.5">
                            {pendingRows.map(row => (
                                <button
                                    key={row.id}
                                    onClick={() => toggleGp(row.id)}
                                    className="text-left text-xs font-semibold text-slate-700 hover:text-emerald-700 flex items-center gap-2"
                                >
                                    {selectedSet.has(row.id) ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Circle size={13} className="text-slate-300" />}
                                    <span className="truncate">{row.name} - {row.block}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FieldVisits = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const toast = useToast();

    const [drafts, setDrafts] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [planDateById, setPlanDateById] = useState({});
    const [planningNoteText, setPlanningNoteText] = useState('');
    const [planningNoteItems, setPlanningNoteItems] = useState([]);
    const [homeBase, setHomeBase] = useState('Collectorate, Dantewada');
    const [savingPlanningNotes, setSavingPlanningNotes] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestionDate, setSuggestionDate] = useState(getTodayInputValue());
    const [suggestionMaxStops, setSuggestionMaxStops] = useState(4);
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [scheduleContext, setScheduleContext] = useState(null);
    const [scheduling, setScheduling] = useState(false);
    const [coverage, setCoverage] = useState(EMPTY_COVERAGE);
    const [selectedGpIds, setSelectedGpIds] = useState([]);
    const [coverageFilters, setCoverageFilters] = useState({ search: '', block: 'all', status: 'all' });
    const [coverageVisitDate, setCoverageVisitDate] = useState(getTodayInputValue());
    const [coverageVisitNotes, setCoverageVisitNotes] = useState('');
    const [markingCoverage, setMarkingCoverage] = useState(false);
    const localNotepadKey = 'field_visit_planning_notepad_v1';

    const [form, setForm] = useState({
        title: '',
        planned_date: getTodayInputValue(),
        planned_time: '10:00',
        est_duration_minutes: 120,
        department_id: '',
        visit_places_note: '',
        people_going: '',
    });

    const todayDate = useMemo(() => getTodayInputValue(), []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [rowsRes, deptRes, notesRes, itemsRes, empRes, coverageRes] = await Promise.allSettled([
                api.getFieldVisitDrafts(),
                api.getDepartments(),
                api.getFieldVisitPlanningNotes(),
                api.getFieldVisitPlanningNoteItems(),
                api.getEmployees(),
                api.getFieldVisitCoverage(),
            ]);
            const rows = rowsRes.status === 'fulfilled' ? (rowsRes.value || []) : [];
            const deptRows = deptRes.status === 'fulfilled' ? (deptRes.value || []) : [];
            const notesData = notesRes.status === 'fulfilled' ? (notesRes.value || {}) : {};
            const noteItems = itemsRes.status === 'fulfilled' ? (itemsRes.value || []) : [];
            const employeeRows = empRes.status === 'fulfilled' ? (empRes.value || []) : [];
            const coverageData = coverageRes.status === 'fulfilled' ? (coverageRes.value || EMPTY_COVERAGE) : EMPTY_COVERAGE;

            setDrafts(rows);
            setDepartments(deptRows);
            setPlanningNoteText(notesData?.note_text || '');
            setHomeBase(notesData?.home_base || 'Collectorate, Dantewada');
            setPlanningNoteItems(noteItems?.length ? noteItems : parseNotepadLines(notesData?.note_text || ''));
            setEmployees(employeeRows.filter(emp => emp.is_active !== false));
            setCoverage(coverageData);

            if (notesRes.status !== 'fulfilled' || itemsRes.status !== 'fulfilled') {
                const cached = window.localStorage.getItem(localNotepadKey);
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        const noteText = parsed?.note_text || '';
                        const base = parsed?.home_base || 'Collectorate, Dantewada';
                        if (!notesData?.note_text) setPlanningNoteText(noteText);
                        if (!notesData?.home_base) setHomeBase(base);
                        if (!noteItems?.length) setPlanningNoteItems(parseNotepadLines(noteText));
                    } catch {
                        // ignore local cache parse errors
                    }
                }
            }

            const defaults = {};
            rows.forEach(item => {
                defaults[item.id] = item.planned_date || todayDate;
            });
            setPlanDateById(defaults);

            const failed = [rowsRes, deptRes, notesRes, itemsRes, empRes, coverageRes].some(r => r.status === 'rejected');
            if (failed) {
                toast.info('Some Field Visit data could not load. Check backend server and refresh.');
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load field visit data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const handleCreateDraft = async (e) => {
        e.preventDefault();
        if (!cleanText(form.title)) {
            toast.error('Visit name is required');
            return;
        }
        if (!cleanText(form.visit_places_note)) {
            toast.error('Visit places notepad is required');
            return;
        }
        try {
            const firstPlace = firstPlaceFromVisitNote(form.visit_places_note);
            const created = await api.createFieldVisitDraft({
                title: cleanText(form.title),
                planned_date: form.planned_date || null,
                planned_time: form.planned_time || null,
                est_duration_minutes: Math.max(30, parseInt(form.est_duration_minutes, 10) || 120),
                department_id: form.department_id ? parseInt(form.department_id, 10) : null,
                visit_places_note: form.visit_places_note,
                people_going: form.people_going,
                location: firstPlace || null,
                focus_points: form.visit_places_note,
                status: 'Draft',
            });
            setDrafts(prev => [...prev, created]);
            setPlanDateById(prev => ({ ...prev, [created.id]: created.planned_date || form.planned_date || todayDate }));
            setForm({
                title: '',
                planned_date: todayDate,
                planned_time: '10:00',
                est_duration_minutes: 120,
                department_id: '',
                visit_places_note: '',
                people_going: '',
            });
            toast.success('Field visit draft added');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to add draft');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this field visit draft?')) return;
        try {
            await api.deleteFieldVisitDraft(id);
            setDrafts(prev => prev.filter(item => item.id !== id));
            toast.success('Draft deleted');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to delete draft');
        }
    };

    const moveDraft = async (id, direction) => {
        const idx = drafts.findIndex(item => item.id === id);
        if (idx < 0) return;
        const target = idx + direction;
        if (target < 0 || target >= drafts.length) return;
        const next = [...drafts];
        const [moved] = next.splice(idx, 1);
        next.splice(target, 0, moved);
        setDrafts(next);
        try {
            await api.reorderFieldVisitDrafts(next.map(item => item.id));
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to reorder drafts');
            loadAll();
        }
    };

    const savePlanningNotes = async () => {
        setSavingPlanningNotes(true);
        try {
            const saved = await api.updateFieldVisitPlanningNotes({
                note_text: planningNoteText,
                home_base: homeBase,
            });
            const parsed = await api.getFieldVisitPlanningNoteItems();
            setPlanningNoteItems(parsed?.length ? parsed : parseNotepadLines(saved?.note_text || ''));
            setPlanningNoteText(saved?.note_text || '');
            setHomeBase(saved?.home_base || 'Collectorate, Dantewada');
            window.localStorage.setItem(localNotepadKey, JSON.stringify({
                note_text: saved?.note_text || '',
                home_base: saved?.home_base || 'Collectorate, Dantewada',
            }));
            toast.success('Planning notepad saved');
        } catch (e) {
            const detail = e?.response?.data?.detail || '';
            if (e?.response?.status === 404) {
                window.localStorage.setItem(localNotepadKey, JSON.stringify({
                    note_text: planningNoteText || '',
                    home_base: homeBase || 'Collectorate, Dantewada',
                }));
                setPlanningNoteItems(parseNotepadLines(planningNoteText || ''));
                toast.info('Backend route not found. Saved notepad locally in browser.');
            } else {
                toast.error(detail || 'Failed to save notepad');
            }
        } finally {
            setSavingPlanningNotes(false);
        }
    };

    const generateSuggestions = async () => {
        setSuggesting(true);
        try {
            await api.updateFieldVisitPlanningNotes({
                note_text: planningNoteText,
                home_base: homeBase,
            });
            const [result, parsedItems] = await Promise.all([
                api.getFieldVisitSuggestions({
                    visit_date: suggestionDate || todayDate,
                    max_stops: Math.max(2, Math.min(8, parseInt(suggestionMaxStops, 10) || 4)),
                }),
                api.getFieldVisitPlanningNoteItems(),
            ]);
            setPlanningNoteItems(parsedItems || []);
            setSuggestions(result?.suggestions || []);
            if (!(result?.suggestions || []).length) {
                toast.info('No suggestions yet. Add more drafts or notepad lines.');
            } else {
                toast.success(`Generated ${(result?.suggestions || []).length} route plan(s)`);
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to generate suggestions');
        } finally {
            setSuggesting(false);
        }
    };

    const openSchedule = (context) => {
        setScheduleContext(context);
        setScheduleModalOpen(true);
    };

    const openScheduleFromDraft = (draft) => {
        openSchedule({
            type: 'draft',
            sourceDraftId: draft.id,
            initial: {
                title: draft.title || '',
                date: draft.planned_date || planDateById[draft.id] || todayDate,
                time_slot: draft.planned_time || '10:00',
                duration_minutes: draft.est_duration_minutes || 120,
                department_id: draft.department_id || '',
                visit_places_note: draft.visit_places_note || draft.focus_points || '',
                people_going: draft.people_going || '',
            },
        });
    };

    const openScheduleFromNotepad = (item) => {
        const title = item?.location ? `${item.location} Field Visit` : 'Field Visit';
        const visitNote = item?.details || item?.title || '';
        openSchedule({
            type: 'notepad',
            sourceNotepadLine: item?.line_no,
            initial: {
                title,
                date: suggestionDate || todayDate,
                time_slot: '10:00',
                duration_minutes: 90,
                department_id: '',
                visit_places_note: visitNote,
                people_going: '',
            },
        });
    };

    const openScheduleFromSuggestion = (plan) => {
        openSchedule({
            type: 'suggestion',
            initial: {
                title: plan?.suggested_title || plan?.plan_title || 'Field Visit',
                date: plan?.visit_date || suggestionDate || todayDate,
                time_slot: '10:00',
                duration_minutes: plan?.estimated_total_minutes || 120,
                department_id: plan?.suggested_department_id || '',
                visit_places_note: plan?.suggested_visit_places_note || '',
                people_going: plan?.suggested_people_going || '',
            },
        });
    };

    const openScheduleFromSuggestionStop = (plan, stop) => {
        const baseTitle = cleanText(stop?.location || stop?.title || plan?.suggested_title || 'Field Visit');
        const stopLine = cleanText(stop?.details) || cleanText(stop?.title) || cleanText(stop?.location);
        openSchedule({
            type: 'suggestion-stop',
            initial: {
                title: baseTitle ? `${baseTitle} Visit` : (plan?.suggested_title || 'Field Visit'),
                date: plan?.visit_date || suggestionDate || todayDate,
                time_slot: '10:00',
                duration_minutes: Math.max(30, parseInt(stop?.duration_minutes || 60, 10) || 60),
                department_id: stop?.department_id || plan?.suggested_department_id || '',
                visit_places_note: stopLine || plan?.suggested_visit_places_note || '',
                people_going: plan?.suggested_people_going || '',
            },
        });
    };

    const handleFinalizeSchedule = async ({ form: modalForm, message, recipients }) => {
        setScheduling(true);
        try {
            const deptId = modalForm.department_id ? parseInt(modalForm.department_id, 10) : null;
            const firstPlace = firstPlaceFromVisitNote(modalForm.visit_places_note);
            const eventPayload = {
                title: cleanText(modalForm.title),
                date: modalForm.date,
                time_slot: modalForm.time_slot,
                duration_minutes: Math.max(30, parseInt(modalForm.duration_minutes, 10) || 120),
                event_type: 'field-visit',
                status: 'Confirmed',
                color: 'emerald',
                department_id: deptId,
                venue: firstPlace || null,
                attendees: modalForm.people_going || null,
                description: `Visit Places:\n${modalForm.visit_places_note}\n\nPeople Going: ${modalForm.people_going || '-'}`,
                source: scheduleContext?.type === 'draft' && scheduleContext?.sourceDraftId
                    ? `field_visit_draft:${scheduleContext.sourceDraftId}`
                    : 'field_visit',
            };
            const plannerEvent = await api.createPlannerEvent(eventPayload);
            const linkedDraftId = plannerEvent?.field_visit_draft_id || null;

            if (scheduleContext?.type === 'draft' && scheduleContext?.sourceDraftId) {
                await api.updateFieldVisitDraft(scheduleContext.sourceDraftId, {
                    title: cleanText(modalForm.title),
                    planned_date: modalForm.date,
                    planned_time: modalForm.time_slot,
                    est_duration_minutes: Math.max(30, parseInt(modalForm.duration_minutes, 10) || 120),
                    department_id: deptId,
                    visit_places_note: modalForm.visit_places_note,
                    people_going: modalForm.people_going,
                    location: firstPlace || null,
                    focus_points: modalForm.visit_places_note,
                    status: 'Planned',
                });
            } else if (linkedDraftId) {
                await api.updateFieldVisitDraft(linkedDraftId, {
                    title: cleanText(modalForm.title),
                    planned_date: modalForm.date,
                    planned_time: modalForm.time_slot,
                    est_duration_minutes: Math.max(30, parseInt(modalForm.duration_minutes, 10) || 120),
                    department_id: deptId,
                    visit_places_note: modalForm.visit_places_note,
                    people_going: modalForm.people_going,
                    location: firstPlace || null,
                    focus_points: modalForm.visit_places_note,
                    status: 'Planned',
                });
            } else {
                await api.createFieldVisitDraft({
                    title: cleanText(modalForm.title),
                    planned_date: modalForm.date,
                    planned_time: modalForm.time_slot,
                    est_duration_minutes: Math.max(30, parseInt(modalForm.duration_minutes, 10) || 120),
                    department_id: deptId,
                    visit_places_note: modalForm.visit_places_note,
                    people_going: modalForm.people_going,
                    location: firstPlace || null,
                    focus_points: modalForm.visit_places_note,
                    status: 'Planned',
                });
            }

            const encoded = encodeURIComponent((message || '').trim());
            recipients.forEach((number, idx) => {
                setTimeout(() => {
                    window.open(`https://wa.me/${number}?text=${encoded}`, '_blank', 'noopener,noreferrer');
                }, idx * 250);
            });

            setScheduleModalOpen(false);
            setScheduleContext(null);
            await loadAll();
            toast.success('Field visit scheduled and message opened in WhatsApp');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to finalize field visit');
        } finally {
            setScheduling(false);
        }
    };

    const updateDraftQuickStatus = async (draft, status) => {
        try {
            const updated = await api.updateFieldVisitDraft(draft.id, { status });
            setDrafts(prev => prev.map(row => (row.id === draft.id ? updated : row)));
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to update status');
        }
    };

    const handleMarkCoverageVisited = async () => {
        if (!selectedGpIds.length) {
            toast.error('Select at least one Gram Panchayat');
            return;
        }
        setMarkingCoverage(true);
        try {
            const updated = await api.markFieldVisitCoverage({
                gp_ids: selectedGpIds,
                visited_on: coverageVisitDate || todayDate,
                notes: coverageVisitNotes,
            });
            setCoverage(updated || EMPTY_COVERAGE);
            toast.success(`${selectedGpIds.length} Gram Panchayat${selectedGpIds.length === 1 ? '' : 's'} marked visited`);
            setSelectedGpIds([]);
            setCoverageVisitNotes('');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to mark visit coverage');
        } finally {
            setMarkingCoverage(false);
        }
    };

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="space-y-6 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-4xl font-black dark:text-white tracking-tight">Field Visits</h1>
                        <p className="text-slate-500 mt-1">
                            Plan by route, schedule directly, and push concise messages to selected staff + steno copy.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/planner')}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
                    >
                        Open Weekly Planner
                    </button>
                </div>

                <FieldVisitCoveragePanel
                    coverage={coverage}
                    selectedGpIds={selectedGpIds}
                    setSelectedGpIds={setSelectedGpIds}
                    filters={coverageFilters}
                    setFilters={setCoverageFilters}
                    visitDate={coverageVisitDate}
                    setVisitDate={setCoverageVisitDate}
                    visitNotes={coverageVisitNotes}
                    setVisitNotes={setCoverageVisitNotes}
                    marking={markingCoverage}
                    onMarkVisited={handleMarkCoverageVisited}
                />

                <form onSubmit={handleCreateDraft} className="glass-card rounded-3xl p-5 border border-indigo-100 order-3">
                    <div className="flex items-center gap-2 mb-4">
                        <Plus size={16} className="text-indigo-600" />
                        <h2 className="font-black text-slate-800 dark:text-white">Add Draft Visit Item</h2>
                    </div>
                    <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-3">
                        <input
                            value={form.title}
                            onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Visit name"
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800"
                        />
                        <input
                            type="date"
                            value={form.planned_date}
                            onChange={(e) => setForm(prev => ({ ...prev, planned_date: e.target.value }))}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800"
                        />
                        <input
                            type="time"
                            value={form.planned_time}
                            onChange={(e) => setForm(prev => ({ ...prev, planned_time: e.target.value }))}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800"
                        />
                        <input
                            value={form.est_duration_minutes}
                            onChange={(e) => setForm(prev => ({ ...prev, est_duration_minutes: e.target.value }))}
                            type="number"
                            min={30}
                            step={15}
                            placeholder="Duration (minutes)"
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800"
                        />
                        <select
                            value={form.department_id}
                            onChange={(e) => setForm(prev => ({ ...prev, department_id: e.target.value }))}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800"
                        >
                            <option value="">No specific department</option>
                            {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                        </select>
                        <input
                            value={form.people_going}
                            onChange={(e) => setForm(prev => ({ ...prev, people_going: e.target.value }))}
                            placeholder="People who will go along"
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800"
                        />
                    </div>
                    <textarea
                        value={form.visit_places_note}
                        onChange={(e) => setForm(prev => ({ ...prev, visit_places_note: e.target.value }))}
                        rows={3}
                        placeholder="Visit places notepad"
                        className="w-full mt-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 resize-none"
                    />
                    <div className="mt-3 flex justify-end">
                        <button type="submit" className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                            Save Draft
                        </button>
                    </div>
                </form>

                <div className="grid lg:grid-cols-2 gap-4 order-2">
                    <div className="glass-card rounded-3xl p-5 border border-indigo-100">
                        <div className="flex items-center gap-2 mb-3">
                            <FileText size={16} className="text-indigo-600" />
                            <h2 className="font-black text-slate-800 dark:text-white">Visit Planning Notepad</h2>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                            Paste worst performing GPs/high-priority projects (one line each). Use: <span className="font-semibold">Location | Priority item | Notes</span>
                        </p>
                        <div className="grid md:grid-cols-2 gap-2 mb-2">
                            <input
                                value={homeBase}
                                onChange={(e) => setHomeBase(e.target.value)}
                                placeholder="Home base"
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800"
                            />
                            <button
                                onClick={savePlanningNotes}
                                disabled={savingPlanningNotes}
                                className="px-3 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                            >
                                <Save size={14} /> {savingPlanningNotes ? 'Saving...' : 'Save Notepad'}
                            </button>
                        </div>
                        <textarea
                            rows={7}
                            value={planningNoteText}
                            onChange={(e) => setPlanningNoteText(e.target.value)}
                            placeholder={'Janpad Dantewada | Worst PMAY progress | backlog\nKatekalyan | Pipeline issue and health outreach gap'}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 resize-none"
                        />

                        <div className="mt-3 rounded-xl border border-slate-200 bg-white max-h-40 overflow-auto divide-y divide-slate-100">
                            {planningNoteItems.length === 0 ? (
                                <p className="px-3 py-3 text-xs text-slate-400 italic">No parsed lines yet.</p>
                            ) : planningNoteItems.map(item => (
                                <div key={item.line_no} className="px-3 py-2.5 flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-700 truncate">{item.line_no}. {item.title || item.details}</p>
                                        {item.location && <p className="text-[11px] text-slate-400 truncate">{item.location}</p>}
                                    </div>
                                    <button
                                        onClick={() => openScheduleFromNotepad(item)}
                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold whitespace-nowrap"
                                    >
                                        Schedule
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card rounded-3xl p-5 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={16} className="text-emerald-600" />
                            <h2 className="font-black text-slate-800 dark:text-white">Route-wise Day Suggestions</h2>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                            Smarter clustering by route anchor + priority score from drafts and notepad.
                        </p>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <input
                                type="date"
                                value={suggestionDate}
                                onChange={(e) => setSuggestionDate(e.target.value)}
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800"
                            />
                            <input
                                type="number"
                                min={2}
                                max={8}
                                value={suggestionMaxStops}
                                onChange={(e) => setSuggestionMaxStops(e.target.value)}
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800"
                            />
                            <button
                                onClick={generateSuggestions}
                                disabled={suggesting}
                                className="px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                            >
                                <Route size={14} /> {suggesting ? 'Generating...' : 'Suggest Route'}
                            </button>
                        </div>

                        <div className="space-y-2 max-h-[310px] overflow-auto pr-1 custom-scrollbar">
                            {suggestions.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No suggestions generated yet.</p>
                            ) : suggestions.map((plan, planIdx) => (
                                <div key={`${plan.route_key}-${planIdx}`} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800">{plan.plan_title}</h4>
                                            <p className="text-xs text-slate-500">{plan.stop_count} stops · {plan.estimated_total_minutes} mins</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {plan.route_map_link && (
                                                <a
                                                    href={plan.route_map_link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold inline-flex items-center gap-1"
                                                >
                                                    <ExternalLink size={12} /> Route Map
                                                </a>
                                            )}
                                            <button
                                                onClick={() => openScheduleFromSuggestion(plan)}
                                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                                            >
                                                Schedule Route
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {(plan.stops || []).map((stop, stopIdx) => (
                                            <div key={`${planIdx}-${stopIdx}`} className="flex items-start justify-between gap-2 text-xs text-slate-700">
                                                <div className="min-w-0">
                                                    <span className="font-bold text-emerald-700">{stopIdx + 1}.</span> {stop.title}
                                                    {stop.location ? ` — ${stop.location}` : ''}
                                                    <span className="text-slate-400"> ({stop.source_type})</span>
                                                </div>
                                                <button
                                                    onClick={() => openScheduleFromSuggestionStop(plan, stop)}
                                                    className="px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 text-[11px] font-bold whitespace-nowrap hover:bg-emerald-100"
                                                >
                                                    Schedule
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="glass-card rounded-3xl overflow-hidden order-1">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-black text-slate-800 dark:text-white">Proposed Field Visit List ({drafts.length})</h3>
                        <span className="text-xs text-slate-500">Use reorder arrows to prioritize weekly draft sequence.</span>
                    </div>

                    {loading ? (
                        <div className="p-8 text-slate-400">Loading drafts...</div>
                    ) : drafts.length === 0 ? (
                        <div className="p-8 text-slate-400">No draft visits yet. Add first item above.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {drafts.map((item, idx) => {
                                const visitNote = item.visit_places_note || item.focus_points || '';
                                const mapQuery = item.location || firstPlaceFromVisitNote(visitNote);
                                const mapLink = buildMapSearchLink(mapQuery);
                                const mapEmbed = buildMapEmbedLink(mapQuery);
                                return (
                                    <div key={item.id} className="p-4">
                                        <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="text-lg font-black text-slate-800">{item.title}</h4>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.status === 'Done' ? 'bg-emerald-100 text-emerald-700' : item.status === 'Planned' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {item.status}
                                                    </span>
                                                    {item.department_name && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{item.department_name}</span>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                                                    <span className="inline-flex items-center gap-1"><Calendar size={13} /> {toDisplayDate(item.planned_date || planDateById[item.id])}</span>
                                                    <span className="inline-flex items-center gap-1"><Clock size={13} /> {item.planned_time || '10:00'}</span>
                                                    <span>{item.est_duration_minutes || 120} min</span>
                                                    {item.people_going && <span className="inline-flex items-center gap-1"><Users size={13} /> {item.people_going}</span>}
                                                </div>
                                                {visitNote && <p className="mt-1 text-sm text-slate-500 whitespace-pre-line">{visitNote}</p>}
                                                {mapEmbed && (
                                                    <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden">
                                                        <iframe
                                                            title={`map-${item.id}`}
                                                            src={mapEmbed}
                                                            className="w-full h-36"
                                                            loading="lazy"
                                                            referrerPolicy="no-referrer-when-downgrade"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => moveDraft(item.id, -1)}
                                                    disabled={idx === 0}
                                                    className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                                                    title="Move up"
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button
                                                    onClick={() => moveDraft(item.id, 1)}
                                                    disabled={idx === drafts.length - 1}
                                                    className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                                                    title="Move down"
                                                >
                                                    <ArrowDown size={14} />
                                                </button>
                                                <input
                                                    type="date"
                                                    value={planDateById[item.id] || item.planned_date || todayDate}
                                                    onChange={(e) => setPlanDateById(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                    className="px-2 py-2 rounded-lg border border-slate-200 text-sm"
                                                />
                                                <button
                                                    onClick={() => openScheduleFromDraft({
                                                        ...item,
                                                        planned_date: planDateById[item.id] || item.planned_date || todayDate,
                                                    })}
                                                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-1"
                                                >
                                                    <Calendar size={13} /> Schedule
                                                </button>
                                                <button
                                                    onClick={() => updateDraftQuickStatus(item, item.status === 'Done' ? 'Draft' : 'Done')}
                                                    className={`px-3 py-2 rounded-lg border text-sm font-semibold ${item.status === 'Done' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-600'}`}
                                                >
                                                    {item.status === 'Done' ? 'Reopen' : 'Done'}
                                                </button>
                                                {mapLink && (
                                                    <a
                                                        href={mapLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold inline-flex items-center gap-1"
                                                    >
                                                        <MapPin size={13} /> Map
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 rounded-lg border border-rose-200 text-rose-500"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <ScheduleVisitModal
                isOpen={scheduleModalOpen}
                onClose={() => { setScheduleModalOpen(false); setScheduleContext(null); }}
                onFinalize={handleFinalizeSchedule}
                initialData={scheduleContext?.initial || null}
                departments={departments}
                employees={employees}
                saving={scheduling}
            />
        </Layout>
    );
};

export default FieldVisits;
