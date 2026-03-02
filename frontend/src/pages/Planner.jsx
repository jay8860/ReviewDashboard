import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Plus, Trash2, X, RefreshCw, Settings, GripVertical,
    CalendarClock, Link2, Search
} from 'lucide-react';
import {
    format, startOfWeek, addDays, addWeeks, subWeeks, parseISO, isSameDay, getISODay,
} from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

const EVENT_TYPES = ['meeting', 'review', 'task', 'field-visit', 'other'];
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

const WAIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const tokenizeText = (value) => normalizeText(value).split(' ').filter((token) => token.length >= 3);

const normalizeWhatsAppNumber = (value) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length > 10) digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = `91${digits}`;
    return digits;
};

const buildWhatsAppSendUrl = (number, message) => {
    const encoded = encodeURIComponent(String(message || '').trim());
    if (!number) {
        return `https://api.whatsapp.com/send/?text=${encoded}&type=custom_url&app_absent=0`;
    }
    return `https://api.whatsapp.com/send/?phone=${number}&text=${encoded}&type=phone_number&app_absent=0`;
};

const splitAttendeeNames = (attendees) =>
    String(attendees || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const extractTaskNameFromDescription = (description) => {
    const lines = String(description || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const taskLine = lines.find((line) => /^task\s*:/i.test(line));
    if (!taskLine) return '';
    return taskLine.replace(/^task\s*:/i, '').trim();
};

const eventCandidateStrings = (event) => {
    const candidates = [];
    if (!event) return candidates;
    candidates.push(...splitAttendeeNames(event.attendees));
    if (event.title) candidates.push(event.title);
    if (event.description) candidates.push(event.description);
    if (event.venue) candidates.push(event.venue);
    if (event.department_name) candidates.push(event.department_name);
    return candidates.filter(Boolean);
};

const getEmployeeSortLabel = (employee) => {
    const label = String(employee?.display_username || '').trim();
    if (label) return label;
    return String(employee?.name || '').trim() || `Employee ${employee?.id || ''}`.trim();
};

const sortEmployeesForLists = (rows = []) => (
    [...rows].sort((a, b) => getEmployeeSortLabel(a).localeCompare(getEmployeeSortLabel(b), undefined, { sensitivity: 'base' }))
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
    // Accept CEO + area even when "JP" is written as Janpad/abbrev in mixed forms.
    return text.includes('jp') || text.includes('janpad') || text.includes('block') || hasArea;
};

const getRecipientNumbersForEmployee = (employee, allEmployees = []) => {
    if (!employee) return [];
    if (isAllCeosEmployee(employee)) {
        const jpCeos = (allEmployees || []).filter(isJpCeoEmployee);
        const numbers = jpCeos.map((row) => normalizeWhatsAppNumber(row?.mobile_number)).filter(Boolean);
        return [...new Set(numbers)];
    }
    const one = normalizeWhatsAppNumber(employee.mobile_number);
    return one ? [one] : [];
};

const autoSelectRecipientsForEvents = (events = [], employees = []) => {
    if (!employees.length) return [];
    const picked = new Set();

    events.forEach((event) => {
        const pickedBefore = picked.size;
        const deptId = event?.department_id ? Number(event.department_id) : null;
        const candidates = eventCandidateStrings(event).map(normalizeText).filter(Boolean);
        const candidateTokens = new Set(candidates.flatMap((candidate) => tokenizeText(candidate)));
        const employeeIdFromEvent = event?.assigned_employee_id ? Number(event.assigned_employee_id) : null;
        let matchedThisEvent = false;

        if (employeeIdFromEvent) {
            picked.add(employeeIdFromEvent);
            matchedThisEvent = true;
        }

        employees.forEach((emp) => {
            const empName = normalizeText(emp?.name);
            const empUsername = normalizeText(emp?.display_username);
            const empMobile = normalizeWhatsAppNumber(emp?.mobile_number);
            const empTokens = new Set([
                ...tokenizeText(empName),
                ...tokenizeText(empUsername),
            ]);

            const matchByText = candidates.some((candidate) => (
                (empName && candidate.includes(empName)) ||
                (empName && empName.includes(candidate)) ||
                (empUsername && candidate.includes(empUsername)) ||
                (empMobile && candidate.includes(empMobile))
            ));
            const matchByToken = [...empTokens].some((token) => candidateTokens.has(token));

            if (matchByText || matchByToken) {
                picked.add(emp.id);
                matchedThisEvent = true;
            }
        });

        // Fallback: if no explicit attendee match and department is set, include department employees.
        if (deptId && !matchedThisEvent && picked.size === pickedBefore) {
            employees.forEach((emp) => {
                if (Number(emp?.department_id || 0) === deptId) picked.add(emp.id);
            });
        }
    });

    return [...picked];
};

const parseDateSafe = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const text = String(value).trim();
    if (!text) return null;

    const parsedIso = parseISO(text);
    if (!Number.isNaN(parsedIso.getTime())) return parsedIso;

    const parsedNative = new Date(text);
    if (!Number.isNaN(parsedNative.getTime())) return parsedNative;

    const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (!match) return null;
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const yearRaw = parseInt(match[3], 10);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900)) return null;
    const parsedManual = new Date(year, month - 1, day);
    if (Number.isNaN(parsedManual.getTime())) return null;
    return parsedManual;
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

const getTodayIso = () => format(new Date(), 'yyyy-MM-dd');

const formatTimeForMessage = (value) => {
    const text = String(value || '').trim();
    if (!text) return 'TBD';
    const match24 = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match24) return text;
    let hour = parseInt(match24[1], 10);
    const minute = match24[2];
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${suffix}`;
};

const normalizeTimeForInput = (value, fallback = '10:00') => {
    const text = String(value || '').trim();
    if (!text) return fallback;
    const hhmm = text.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
        const hour = Math.max(0, Math.min(23, parseInt(hhmm[1], 10)));
        const minute = Math.max(0, Math.min(59, parseInt(hhmm[2], 10)));
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    const ampm = text.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
        let hour = parseInt(ampm[1], 10);
        const minute = Math.max(0, Math.min(59, parseInt(ampm[2], 10)));
        const suffix = ampm[3].toUpperCase();
        if (suffix === 'PM' && hour < 12) hour += 12;
        if (suffix === 'AM' && hour === 12) hour = 0;
        hour = Math.max(0, Math.min(23, hour));
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    return fallback;
};

const buildPlannerEventWhatsAppMessage = (event) => {
    const title = (event?.title || 'meeting').trim();
    const dateText = formatDateSafe(event?.date, 'd MMMM yyyy', 'TBD');
    const timeText = formatTimeForMessage(event?.time_slot);
    const taskName = extractTaskNameFromDescription(event?.description);
    const venueText = String(event?.venue || '').trim();
    const attendeeNames = splitAttendeeNames(event?.attendees);
    const meetingWith = attendeeNames.length ? attendeeNames.join(', ') : title;
    const notesOnly = String(event?.description || '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !/^task\s*:/i.test(line))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    let sentence = `Meeting to be scheduled with ${meetingWith} on ${dateText} at ${timeText}`;
    if (taskName) sentence += ` on task "${taskName}"`;
    else sentence += ` regarding "${title}"`;
    if (venueText) sentence += ` at ${venueText}`;
    sentence += '.';
    if (notesOnly) sentence += ` Note: ${notesOnly}`;

    return sentence;
};

const PlannerEventWhatsAppModal = ({ isOpen, onClose, event, employees = [] }) => {
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
    const sortedEmployees = useMemo(() => sortEmployeesForLists(employees), [employees]);

    useEffect(() => {
        if (!isOpen || !event) return;
        setMessage(buildPlannerEventWhatsAppMessage(event));
        setSearchTerm('');
        setSelectedEmployeeIds(autoSelectRecipientsForEvents([event], employees));
    }, [isOpen, event, employees]);

    if (!isOpen || !event) return null;

    const visibleEmployees = sortedEmployees.filter(emp => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            (emp.name || '').toLowerCase().includes(q) ||
            (emp.display_username || '').toLowerCase().includes(q) ||
            (emp.mobile_number || '').toLowerCase().includes(q)
        );
    });
    const selectedEmployees = selectedEmployeeIds
        .map((id) => employees.find((emp) => emp.id === id))
        .filter(Boolean);
    const selectableEmployees = visibleEmployees.filter((emp) => !selectedEmployeeIds.includes(emp.id));

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
            const employee = employeeMap.get(id);
            const resolved = getRecipientNumbersForEmployee(employee, employees);
            if (resolved.length) numbers.push(...resolved);
        });
        return [...new Set(numbers.filter(Boolean))];
    };

    const handleSend = () => {
        const finalMessage = (message || '').trim();
        if (!finalMessage) {
            window.alert('Message draft cannot be empty');
            return;
        }
        const recipients = buildRecipientNumbers();
        if (!recipients.length) {
            window.alert('Select at least one recipient');
            return;
        }

        recipients.forEach((number, idx) => {
            setTimeout(() => {
                window.open(buildWhatsAppSendUrl(number, finalMessage), '_blank', 'noopener,noreferrer');
            }, idx * 250);
        });
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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
                                <h2 className="text-lg font-black dark:text-white">WhatsApp Event Draft</h2>
                                <p className="text-xs text-slate-400">{event.title || 'Calendar Event'}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">
                            <X size={18} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="p-6 grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Recipients</p>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 mb-2">Selected recipients ({selectedEmployees.length})</p>
                                {selectedEmployees.length === 0 ? (
                                    <p className="text-xs text-emerald-700/70 italic">No recipients selected yet.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedEmployees.map((emp) => (
                                            <button
                                                key={emp.id}
                                                onClick={() => toggleEmployee(emp.id)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                                title="Remove recipient"
                                            >
                                                {emp.name}
                                                <X size={12} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

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
                                {selectableEmployees.length === 0 ? (
                                    <p className="px-3 py-3 text-xs text-slate-400 italic">No employees found.</p>
                                ) : selectableEmployees.map(emp => (
                                    <label key={emp.id} className="px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="checkbox"
                                            checked={false}
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

                    <div className="px-6 pb-6 flex items-center justify-end gap-2">
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
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const buildDayScheduleMessage = (dateValue, items) => {
    const headingDate = formatDateSafe(dateValue, 'd MMMM yyyy', 'TBD');
    if (!items.length) {
        return `No meetings or events are scheduled for ${headingDate}.`;
    }

    const lines = items.map((event, idx) => {
        const timeText = formatTimeForMessage(event.time_slot);
        const typeText = (event.event_type || 'event').replace('-', ' ');
        const attendeeNames = splitAttendeeNames(event.attendees);
        const who = attendeeNames.length ? attendeeNames.join(', ') : (event.title || 'concerned officer');
        const topic = extractTaskNameFromDescription(event.description) || event.title || typeText;
        return `${idx + 1}. At ${timeText}, schedule a ${typeText} with ${who} regarding "${topic}".`;
    });

    return `Please schedule the following meetings/events for ${headingDate}:\n${lines.join('\n')}`;
};

const PlannerDayWhatsAppModal = ({ isOpen, onClose, events = [], employees = [], defaultDate }) => {
    const [day, setDay] = useState(defaultDate || getTodayIso());
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
    const sortedEmployees = useMemo(() => sortEmployeesForLists(employees), [employees]);

    const dayEvents = useMemo(() => {
        if (!day) return [];
        const parsedDay = parseDateSafe(day);
        if (!parsedDay) return [];
        return [...events]
            .filter((event) => {
                const parsedDate = parseDateSafe(event?.date);
                if (!parsedDate) return false;
                return isSameDay(parsedDate, parsedDay) && normalizeStatus(event?.status) !== 'Cancelled';
            })
            .sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));
    }, [events, day]);

    useEffect(() => {
        if (!isOpen) return;
        setDay(defaultDate || getTodayIso());
        setSearchTerm('');
    }, [isOpen, defaultDate]);

    useEffect(() => {
        if (!isOpen) return;
        setMessage(buildDayScheduleMessage(day, dayEvents));
    }, [isOpen, day, dayEvents]);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedEmployeeIds(autoSelectRecipientsForEvents(dayEvents, employees));
    }, [isOpen, dayEvents, employees]);

    if (!isOpen) return null;

    const visibleEmployees = sortedEmployees.filter((emp) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return (
            (emp.name || '').toLowerCase().includes(q) ||
            (emp.display_username || '').toLowerCase().includes(q) ||
            (emp.mobile_number || '').toLowerCase().includes(q)
        );
    });
    const selectedEmployees = selectedEmployeeIds
        .map((id) => employees.find((emp) => emp.id === id))
        .filter(Boolean);
    const selectableEmployees = visibleEmployees.filter((emp) => !selectedEmployeeIds.includes(emp.id));

    const toggleEmployee = (id) => {
        setSelectedEmployeeIds((prev) => (
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        ));
    };

    const buildRecipientNumbers = () => {
        const numbers = [];
        const employeeMap = new Map(employees.map((emp) => [emp.id, emp]));
        selectedEmployeeIds.forEach((id) => {
            const employee = employeeMap.get(id);
            const resolved = getRecipientNumbersForEmployee(employee, employees);
            if (resolved.length) numbers.push(...resolved);
        });
        return [...new Set(numbers.filter(Boolean))];
    };

    const handleSend = () => {
        const draft = (message || '').trim();
        if (!draft) {
            window.alert('Message draft cannot be empty');
            return;
        }
        const recipients = buildRecipientNumbers();
        if (!recipients.length) {
            window.alert('Select at least one recipient');
            return;
        }
        recipients.forEach((number, idx) => {
            setTimeout(() => {
                window.open(buildWhatsAppSendUrl(number, draft), '_blank', 'noopener,noreferrer');
            }, idx * 250);
        });
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="glass-card rounded-3xl w-full max-w-4xl shadow-premium-lg max-h-[92vh] overflow-y-auto custom-scrollbar"
                >
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-500/5 dark:to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <WAIcon />
                            </div>
                            <div>
                                <h2 className="text-lg font-black dark:text-white">Day Schedule Message</h2>
                                <p className="text-xs text-slate-400">Send one combined message for a selected date</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">
                            <X size={18} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="p-6 grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Recipients</p>
                            <input
                                type="date"
                                value={day}
                                onChange={(e) => setDay(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm"
                            />
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 mb-2">Selected recipients ({selectedEmployees.length})</p>
                                {selectedEmployees.length === 0 ? (
                                    <p className="text-xs text-emerald-700/70 italic">No recipients selected yet.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedEmployees.map((emp) => (
                                            <button
                                                key={emp.id}
                                                onClick={() => toggleEmployee(emp.id)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                                title="Remove recipient"
                                            >
                                                {emp.name}
                                                <X size={12} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                            <div className="max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                                {selectableEmployees.length === 0 ? (
                                    <p className="px-3 py-3 text-xs text-slate-400 italic">No employees found.</p>
                                ) : selectableEmployees.map(emp => (
                                    <label key={emp.id} className="px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="checkbox"
                                            checked={false}
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

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Selected Day Events</p>
                                {dayEvents.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No events scheduled for this day.</p>
                                ) : (
                                    <ol className="space-y-1">
                                        {dayEvents.map((event, idx) => (
                                            <li key={event.id} className="text-xs text-slate-600">
                                                {idx + 1}. {event.time_slot || 'TBD'} - {event.title}
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Message Draft (Editable)</p>
                            <textarea
                                rows={17}
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
                            onClick={handleSend}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 inline-flex items-center gap-2"
                        >
                            <WAIcon /> Send WhatsApp
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
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

const normalizeModalStatus = (status) => {
    const normalized = normalizeStatus(status);
    return normalized === 'Cancelled' ? 'Cancelled' : 'Confirmed';
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
    prefillData = null,
    defaultDate,
    defaultTime,
    defaultSlotMinutes,
    departments,
    employees,
}) => {
    const [showWhatsappModal, setShowWhatsappModal] = useState(false);
    const [form, setForm] = useState({
        title: '',
        date: defaultDate,
        time_slot: defaultTime,
        duration_minutes: defaultSlotMinutes,
        event_type: 'meeting',
        status: 'Confirmed',
        color: 'indigo',
        description: '',
        venue: '',
        attendees: '',
        department_id: '',
    });

    useEffect(() => {
        if (!isOpen) return;
        setShowWhatsappModal(false);
        if (eventData) {
            setForm({
                title: eventData.title || '',
                date: eventData.date || defaultDate,
                time_slot: normalizeTimeForInput(eventData.time_slot || defaultTime, defaultTime),
                duration_minutes: eventData.duration_minutes || defaultSlotMinutes,
                event_type: eventData.event_type || 'meeting',
                status: normalizeModalStatus(eventData.status),
                color: eventData.color || 'indigo',
                description: eventData.description || '',
                venue: eventData.venue || '',
                attendees: eventData.attendees || '',
                department_id: eventData.department_id || '',
            });
            return;
        }
        if (prefillData) {
            setForm({
                title: prefillData.title || '',
                date: prefillData.date || defaultDate,
                time_slot: normalizeTimeForInput(prefillData.time_slot || defaultTime, defaultTime),
                duration_minutes: prefillData.duration_minutes || defaultSlotMinutes,
                event_type: prefillData.event_type || 'meeting',
                status: normalizeModalStatus(prefillData.status),
                color: prefillData.color || 'indigo',
                description: prefillData.description || '',
                venue: prefillData.venue || '',
                attendees: prefillData.attendees || '',
                department_id: prefillData.department_id || '',
            });
            return;
        }
        setForm({
            title: '',
            date: defaultDate,
            time_slot: normalizeTimeForInput(defaultTime, '10:00'),
            duration_minutes: defaultSlotMinutes,
            event_type: 'meeting',
            status: 'Confirmed',
            color: 'indigo',
            description: '',
            venue: '',
            attendees: '',
            department_id: '',
        });
    }, [isOpen, eventData, prefillData, defaultDate, defaultTime, defaultSlotMinutes]);

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
                        {(form.event_type === 'meeting' || form.event_type === 'review') && form.department_id && (
                            <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 text-xs text-violet-700 font-semibold">
                                Confirmed department meetings auto-create Meeting Workspace entries.
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowWhatsappModal(true)}
                                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 inline-flex items-center gap-1.5"
                            >
                                <WAIcon /> WhatsApp
                            </button>
                            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
                                Cancel
                            </button>
                            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                                Save Event
                            </button>
                        </div>
                    </form>
                </motion.div>
                <PlannerEventWhatsAppModal
                    isOpen={showWhatsappModal}
                    onClose={() => setShowWhatsappModal(false)}
                    event={{
                        title: form.title,
                        date: form.date,
                        time_slot: form.time_slot,
                        duration_minutes: parseInt(form.duration_minutes, 10) || 30,
                        event_type: form.event_type,
                        status: form.status,
                        venue: form.venue,
                        attendees: form.attendees,
                        description: form.description,
                    }}
                    employees={employees || []}
                />
            </div>
        </AnimatePresence>
    );
};

const Planner = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();

    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [events, setEvents] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [settings, setSettings] = useState(null);
    const [settingsDraft, setSettingsDraft] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editEvent, setEditEvent] = useState(null);
    const [prefillData, setPrefillData] = useState(null);
    const [dayMessageModalOpen, setDayMessageModalOpen] = useState(false);
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

    const loadEmployees = useCallback(async () => {
        const rows = await api.getEmployees();
        setEmployees((rows || []).filter(emp => emp.is_active !== false));
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
        Promise.all([loadSettings(), loadDepartments(), loadEmployees()]);
    }, [loadSettings, loadDepartments, loadEmployees]);

    useEffect(() => {
        if (!settings) return;
        loadEvents();
    }, [settings, loadEvents]);

    useEffect(() => {
        if (!settings) return;
        const params = new URLSearchParams(location.search);
        const draftIdRaw = params.get('draftId');
        if (!draftIdRaw) return;
        const draftId = parseInt(draftIdRaw, 10);
        if (!draftId) return;

        const hydrateFromDraft = async () => {
            try {
                const draft = await api.getFieldVisitDraft(draftId);
                const chosenDate = params.get('date') || format(new Date(), 'yyyy-MM-dd');
                const details = [
                    draft.theme ? `Theme: ${draft.theme}` : '',
                    draft.village ? `Village: ${draft.village}` : '',
                    draft.focus_points ? `Focus: ${draft.focus_points}` : '',
                ].filter(Boolean).join('\n');

                setEditEvent(null);
                setPrefillData({
                    title: draft.title || 'Field Visit',
                    date: chosenDate,
                    time_slot: settings.day_start || '10:00',
                    duration_minutes: draft.est_duration_minutes || settings.slot_minutes || 30,
                    event_type: 'field-visit',
                    status: 'Confirmed',
                    color: 'emerald',
                    description: details,
                    venue: draft.location || '',
                    attendees: '',
                    department_id: draft.department_id || '',
                });
                setClickedDate(chosenDate);
                setClickedTime(settings.day_start || '10:00');
                setModalOpen(true);

                if ((draft.status || '') === 'Draft') {
                    api.updateFieldVisitDraft(draft.id, { status: 'Planned' }).catch(() => null);
                }
            } catch (e) {
                toast.error(e?.response?.data?.detail || 'Failed to load field visit draft');
            } finally {
                navigate('/planner', { replace: true });
            }
        };

        hydrateFromDraft();
    }, [location.search, settings, navigate, toast]);

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
            const normalizedType = String(payload.event_type || '').toLowerCase();
            if ((normalizedType === 'meeting' || normalizedType === 'review') && !payload.department_id) {
                toast.error('Select a department for meeting/review events');
                return;
            }
            const normalizedPayload = {
                ...payload,
                status: payload.status === 'Cancelled' ? 'Cancelled' : 'Confirmed',
            };
            if (editEvent) {
                await api.updatePlannerEvent(editEvent.id, normalizedPayload);
            } else {
                await api.createPlannerEvent(normalizedPayload);
            }
            setModalOpen(false);
            setEditEvent(null);
            setPrefillData(null);
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

    const getDayEvents = (day) =>
        events
            .filter((e) => {
                const parsedDate = parseDateSafe(e?.date);
                return parsedDate ? isSameDay(parsedDate, day) : false;
            })
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
                        <button onClick={() => setDayMessageModalOpen(true)} className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-bold hover:bg-emerald-200 inline-flex items-center gap-1.5">
                            <WAIcon /> Day Message
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
                                setPrefillData(null);
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
                                                            setPrefillData(null);
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
                                                                    setPrefillData(null);
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
                                                                    {event.field_visit_draft_id && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                navigate('/field-visits');
                                                                            }}
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold"
                                                                        >
                                                                            <Link2 size={10} /> Visit Plan
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
                onClose={() => { setModalOpen(false); setEditEvent(null); setPrefillData(null); }}
                onSave={handleSaveEvent}
                eventData={editEvent}
                prefillData={prefillData}
                defaultDate={clickedDate || format(new Date(), 'yyyy-MM-dd')}
                defaultTime={clickedTime || settings.day_start || '10:00'}
                defaultSlotMinutes={settings.slot_minutes || 30}
                departments={departments}
                employees={employees}
            />
            <PlannerDayWhatsAppModal
                isOpen={dayMessageModalOpen}
                onClose={() => setDayMessageModalOpen(false)}
                events={events}
                employees={employees}
                defaultDate={format(new Date(), 'yyyy-MM-dd')}
            />
        </Layout>
    );
};

export default Planner;
