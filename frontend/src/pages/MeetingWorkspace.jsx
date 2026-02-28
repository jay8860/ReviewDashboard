import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Calendar, MapPin, Users, Phone, Save, Trash2,
    CheckCircle2, XCircle, RefreshCw, Table2, Edit2,
    PlusCircle, Minus, Upload, Download, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import DocumentAnalysisPanel from '../components/DocumentAnalysisPanel';
import TaskSuggestionsEditor from '../components/TaskSuggestionsEditor';

const DEFAULT_COLUMNS = ["Action Point", "Owner", "Timeline", "Status", "Remarks"];

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

const statusStyles = {
    Scheduled: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    Done: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    Cancelled: 'bg-rose-100 text-rose-700 border border-rose-200',
};

const MeetingWorkspace = ({ user, onLogout }) => {
    const { deptId, meetingId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const deptIdInt = parseInt(deptId, 10);
    const meetingIdInt = parseInt(meetingId, 10);

    const [loading, setLoading] = useState(true);
    const [dept, setDept] = useState(null);
    const [meeting, setMeeting] = useState(null);
    const [allMeetings, setAllMeetings] = useState([]);

    const [form, setForm] = useState({
        scheduled_date: '',
        venue: '',
        attendees: '',
        officer_phone: '',
        notes: '',
        status: 'Scheduled',
    });

    const [columns, setColumns] = useState(DEFAULT_COLUMNS);
    const [rows, setRows] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingStatus, setSavingStatus] = useState(false);
    const fileInputRef = useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            const [deptData, meetings] = await Promise.all([
                api.getDepartment(deptIdInt),
                api.getMeetings(deptIdInt),
            ]);
            const found = meetings.find(m => m.id === meetingIdInt) || null;
            setDept(deptData);
            setMeeting(found);
            setAllMeetings(meetings || []);
            if (found) {
                setForm({
                    scheduled_date: found.scheduled_date || '',
                    venue: found.venue || '',
                    attendees: found.attendees || '',
                    officer_phone: found.officer_phone || '',
                    notes: found.notes || '',
                    status: found.status || 'Scheduled',
                });
                setColumns(found.action_table_columns?.length ? found.action_table_columns : DEFAULT_COLUMNS);
                setRows(found.action_table_rows || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [deptId, meetingId]);

    const syncFromMeeting = (updated) => {
        setMeeting(updated);
        setForm({
            scheduled_date: updated.scheduled_date || '',
            venue: updated.venue || '',
            attendees: updated.attendees || '',
            officer_phone: updated.officer_phone || '',
            notes: updated.notes || '',
            status: updated.status || 'Scheduled',
        });
        setColumns(updated.action_table_columns?.length ? updated.action_table_columns : DEFAULT_COLUMNS);
        setRows(updated.action_table_rows || []);
    };

    const saveWorkspace = async () => {
        setSaving(true);
        try {
            const updated = await api.updateMeeting(deptIdInt, meetingIdInt, {
                scheduled_date: form.scheduled_date,
                venue: form.venue,
                attendees: form.attendees,
                officer_phone: form.officer_phone,
                notes: form.notes,
                status: form.status,
                action_table_columns: columns,
                action_table_rows: rows,
            });
            syncFromMeeting(updated);
            setEditMode(false);
            toast.success('Meeting workspace saved');
        } catch {
            toast.error('Failed to save meeting workspace');
        } finally {
            setSaving(false);
        }
    };

    const updateStatusOnly = async (status) => {
        setSavingStatus(true);
        try {
            const updated = await api.updateMeeting(deptIdInt, meetingIdInt, { status });
            syncFromMeeting(updated);
            toast.success(`Meeting marked as ${status}`);
        } catch {
            toast.error('Failed to update status');
        } finally {
            setSavingStatus(false);
        }
    };

    const deleteMeeting = async () => {
        if (!window.confirm('Delete this meeting?')) return;
        try {
            await api.deleteMeeting(deptIdInt, meetingIdInt);
            toast.success('Meeting deleted');
            navigate(`/departments/${deptIdInt}`);
        } catch {
            toast.error('Failed to delete meeting');
        }
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
        const next = `Col ${columns.length + 1}`;
        setColumns(prev => [...prev, next]);
        setRows(prev => prev.map(r => [...r, '']));
    };

    const removeCol = (cIdx) => {
        if (columns.length <= 1) return;
        setColumns(prev => prev.filter((_, i) => i !== cIdx));
        setRows(prev => prev.map(r => r.filter((_, i) => i !== cIdx)));
    };

    const renameCol = (cIdx, value) => {
        setColumns(prev => prev.map((c, i) => (i === cIdx ? value : c)));
    };

    const importCSV = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = String(ev.target?.result || '');
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (!lines.length) return;
            const parsed = lines.map(line => line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim()));
            const importedCols = parsed[0] || [];
            const importedRows = parsed.slice(1);
            if (!importedCols.length) {
                toast.error('CSV has no columns');
                return;
            }
            setColumns(importedCols);
            setRows(importedRows);
            toast.success(`Imported ${importedRows.length} rows`);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const exportCSV = () => {
        const csv = [columns, ...rows]
            .map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-${meetingIdInt}-action-table.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const generateMeetingTaskSuggestions = async () => {
        return api.suggestTasksFromMeetingWorkspace(deptIdInt, meetingIdInt, {});
    };

    const confirmTaskSuggestions = async (suggestions) => {
        return api.confirmTaskSuggestions(deptIdInt, { suggestions });
    };

    if (loading) {
        return (
            <Layout user={user} onLogout={onLogout}>
                <div className="flex items-center justify-center h-64">
                    <RefreshCw size={32} className="animate-spin text-indigo-400" />
                </div>
            </Layout>
        );
    }

    if (!dept || !meeting) {
        return (
            <Layout user={user} onLogout={onLogout}>
                <div className="glass-card rounded-3xl p-10 text-center">
                    <p className="text-lg font-black text-slate-800">Meeting not found</p>
                    <button
                        onClick={() => navigate(`/departments/${deptIdInt}`)}
                        className="mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors"
                    >
                        Back to Department
                    </button>
                </div>
            </Layout>
        );
    }

    const grad = colorGrad[dept.color] || colorGrad.indigo;
    const previousMeeting = [...allMeetings]
        .filter(m => m.id !== meetingIdInt && new Date(m.scheduled_date) < new Date(meeting.scheduled_date))
        .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date))[0];

    const prevCols = previousMeeting?.action_table_columns?.length
        ? previousMeeting.action_table_columns
        : DEFAULT_COLUMNS;
    const prevRows = previousMeeting?.action_table_rows || [];

    const getColIndex = (cols, names) => {
        const lowered = cols.map(c => String(c || '').toLowerCase());
        for (const name of names) {
            const idx = lowered.findIndex(c => c.includes(name));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const prevActionIdx = getColIndex(prevCols, ['action point', 'action', 'item']);
    const prevStatusIdx = getColIndex(prevCols, ['action taken', 'status', 'progress', 'update']);
    const prevRemarkIdx = getColIndex(prevCols, ['remark', 'remarks', 'comment', 'note']);

    const actionTakenSummary = prevRows
        .map((row, i) => {
            const action = row[prevActionIdx] || row[0] || `Action ${i + 1}`;
            const taken = row[prevStatusIdx] || row[prevRemarkIdx] || 'No update recorded';
            return { action, taken };
        })
        .filter(item => item.action || item.taken);

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="space-y-6">
                <div className="glass-card rounded-3xl overflow-hidden border border-indigo-100/70 dark:border-indigo-500/20">
                    <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 via-violet-50 to-white dark:from-indigo-500/10 dark:via-violet-500/10 dark:to-transparent border-b border-indigo-100/70 dark:border-indigo-500/20">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate(`/departments/${deptIdInt}`)}
                                    className="p-2.5 rounded-xl hover:bg-white/80 dark:hover:bg-white/10 text-slate-500 transition-colors"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-lg`}>
                                    <span className="text-white font-black text-sm">{dept.short_name || dept.name.slice(0, 2).toUpperCase()}</span>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Meeting Workspace</h1>
                                    <p className="text-sm text-slate-500">
                                        {dept.name} · {format(new Date(meeting.scheduled_date), 'EEEE, d MMM yyyy')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-black px-3 py-1 rounded-full ${statusStyles[form.status] || statusStyles.Scheduled}`}>
                                    {form.status}
                                </span>
                                <button
                                    onClick={saveWorkspace}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-60"
                                >
                                    <Save size={14} /> {saving ? 'Saving…' : 'Save Workspace'}
                                </button>
                                <button
                                    onClick={() => updateStatusOnly('Done')}
                                    disabled={savingStatus}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60"
                                >
                                    <CheckCircle2 size={14} /> Mark Done
                                </button>
                                <button
                                    onClick={() => updateStatusOnly('Cancelled')}
                                    disabled={savingStatus}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors disabled:opacity-60"
                                >
                                    <XCircle size={14} /> Cancel
                                </button>
                                <button
                                    onClick={deleteMeeting}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 text-sm font-bold hover:bg-rose-100 transition-colors"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white/90 dark:bg-white/5">
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-wider text-violet-500">Date</span>
                            <input
                                type="date"
                                value={form.scheduled_date}
                                onChange={(e) => setForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                                className="mt-1 w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-wider text-violet-500 flex items-center gap-1"><MapPin size={12} /> Venue</span>
                            <input
                                value={form.venue}
                                onChange={(e) => setForm(prev => ({ ...prev, venue: e.target.value }))}
                                placeholder="Meeting room"
                                className="mt-1 w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-wider text-violet-500 flex items-center gap-1"><Users size={12} /> Attendees</span>
                            <input
                                value={form.attendees}
                                onChange={(e) => setForm(prev => ({ ...prev, attendees: e.target.value }))}
                                placeholder="Comma-separated names"
                                className="mt-1 w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-wider text-violet-500 flex items-center gap-1"><Phone size={12} /> Officer Phone</span>
                            <input
                                value={form.officer_phone}
                                onChange={(e) => setForm(prev => ({ ...prev, officer_phone: e.target.value }))}
                                placeholder="+91XXXXXXXXXX"
                                className="mt-1 w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                            />
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="space-y-6">
                        <div className="glass-card rounded-3xl overflow-hidden border border-indigo-100/70 dark:border-indigo-500/20">
                            <div className="px-5 py-4 border-b border-indigo-100 bg-gradient-to-r from-violet-50/70 to-white">
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <FileText size={16} className="text-violet-600" /> Minutes Of Meeting
                                </h2>
                            </div>
                            <div className="p-5 bg-white/90">
                                <textarea
                                    rows={13}
                                    value={form.notes}
                                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Write detailed minutes, observations, decisions and follow-ups..."
                                    className="w-full px-4 py-3 rounded-2xl border border-indigo-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none text-sm"
                                />
                            </div>
                        </div>

                        <div className="glass-card rounded-3xl overflow-hidden border border-indigo-100/70 dark:border-indigo-500/20">
                            <div className="px-5 py-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-white">
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <Calendar size={16} className="text-indigo-600" /> Agenda At Scheduling
                                </h2>
                            </div>
                            <div className="p-5 bg-white/90">
                                {!meeting.agenda_snapshot?.length ? (
                                    <p className="text-sm text-slate-400 italic">No agenda snapshot was stored.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {meeting.agenda_snapshot.map((item, idx) => (
                                            <div key={idx} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                                                <p className="text-xs text-indigo-500 font-black">{idx + 1}. {item.title}</p>
                                                {item.details && <p className="text-xs text-slate-500 mt-1">{item.details}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="glass-card rounded-3xl overflow-hidden border border-indigo-100/70 dark:border-indigo-500/20">
                            <div className="px-5 py-4 border-b border-indigo-100 bg-gradient-to-r from-violet-50/70 to-white">
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <FileText size={16} className="text-violet-600" /> Previous Meeting Context
                                </h2>
                            </div>
                            <div className="p-5 bg-white/90 space-y-4">
                                {!previousMeeting ? (
                                    <p className="text-sm text-slate-400 italic">No previous meeting found for this department.</p>
                                ) : (
                                    <>
                                        <p className="text-xs font-black uppercase tracking-wider text-violet-500">
                                            Last meeting: {format(new Date(previousMeeting.scheduled_date), 'd MMM yyyy')}
                                        </p>

                                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                                            <p className="text-[11px] font-black uppercase tracking-wider text-indigo-500 mb-1">Last Meeting Notes</p>
                                            <p className="text-xs text-slate-700 whitespace-pre-wrap">
                                                {previousMeeting.notes || 'No notes recorded.'}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-indigo-100 overflow-auto">
                                            <table className="w-full text-xs">
                                                <thead className="bg-violet-50">
                                                    <tr>
                                                        {prevCols.map((c, idx) => (
                                                            <th key={idx} className="px-2 py-2 text-left font-black uppercase tracking-wider text-violet-600">{c}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-indigo-100 bg-white">
                                                    {prevRows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={prevCols.length} className="px-2 py-4 text-center text-slate-400 italic">
                                                                No action points in previous meeting.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        prevRows.map((row, rIdx) => (
                                                            <tr key={rIdx}>
                                                                {prevCols.map((_, cIdx) => (
                                                                    <td key={cIdx} className="px-2 py-1.5 text-slate-700">
                                                                        {row[cIdx] || <span className="text-slate-300">—</span>}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                                            <p className="text-[11px] font-black uppercase tracking-wider text-violet-600 mb-2">Action Taken Snapshot</p>
                                            <div className="space-y-1.5">
                                                {actionTakenSummary.length === 0 ? (
                                                    <p className="text-xs text-slate-400 italic">No action-taken entries found.</p>
                                                ) : (
                                                    actionTakenSummary.map((item, i) => (
                                                        <p key={i} className="text-xs text-slate-700">
                                                            <span className="font-black text-violet-500">{i + 1}.</span> {item.action} → {item.taken}
                                                        </p>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <TaskSuggestionsEditor
                            title="Task Suggestions From Meeting Notes"
                            subtitle="Generate tasks only from MOM notes and the action grid. Edit rows before creating tasks."
                            generateLabel="Suggest From Meeting"
                            onGenerate={generateMeetingTaskSuggestions}
                            onConfirmCreate={confirmTaskSuggestions}
                        />

                        <DocumentAnalysisPanel
                            deptId={deptIdInt}
                            meetingId={meetingIdInt}
                            title="Meeting Documents & AI Analysis"
                        />
                    </div>

                    <div className="xl:col-span-2 glass-card rounded-3xl overflow-hidden border border-violet-100/70 dark:border-violet-500/20 min-h-[620px] flex flex-col">
                        <div className="px-5 py-4 border-b border-violet-100 dark:border-violet-500/20 bg-gradient-to-r from-violet-50 to-indigo-50 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <Table2 size={18} className="text-violet-600" />
                                <h2 className="text-lg font-black text-slate-900">Action Points Grid</h2>
                                <span className="text-xs bg-violet-100 text-violet-700 font-black px-2 py-0.5 rounded-full">{rows.length} rows × {columns.length} cols</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors">
                                    <Download size={13} /> Export
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors">
                                    <Upload size={13} /> Import CSV
                                </button>
                                <input ref={fileInputRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
                                <button
                                    onClick={() => setEditMode(v => !v)}
                                    className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${editMode ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                                >
                                    <Edit2 size={13} /> {editMode ? 'Done Editing' : 'Edit Grid'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar bg-white/95">
                            <table className="w-full text-sm border-collapse">
                                <thead className="sticky top-0 z-10 bg-violet-50">
                                    <tr>
                                        <th className="w-9 px-2 py-2 text-xs text-violet-500 font-black border-b border-r border-violet-100">#</th>
                                        {columns.map((col, cIdx) => (
                                            <th key={cIdx} className="px-2 py-2 border-b border-r border-violet-100 text-left font-black text-violet-700 text-xs uppercase tracking-wider min-w-[130px]">
                                                {editMode ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            value={col}
                                                            onChange={(e) => renameCol(cIdx, e.target.value)}
                                                            className="w-full text-xs font-bold bg-white border border-violet-300 rounded px-1 py-0.5 focus:outline-none"
                                                        />
                                                        {columns.length > 1 && (
                                                            <button onClick={() => removeCol(cIdx)} className="p-0.5 text-rose-500 hover:bg-rose-50 rounded">
                                                                <Minus size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : col}
                                            </th>
                                        ))}
                                        {editMode && (
                                            <th className="px-2 py-2 border-b border-violet-100">
                                                <button onClick={addCol} className="flex items-center gap-1 text-xs text-violet-600 font-bold hover:text-violet-800 whitespace-nowrap">
                                                    <PlusCircle size={12} /> Col
                                                </button>
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && !editMode && (
                                        <tr>
                                            <td colSpan={columns.length + 1} className="text-center py-10 text-slate-400 italic text-xs">
                                                No action points yet. Click Edit Grid to start.
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((row, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-violet-50/50 transition-colors">
                                            <td className="px-2 py-1.5 text-xs text-slate-400 font-bold text-center border-r border-b border-violet-100 w-9">
                                                {editMode ? (
                                                    <button onClick={() => removeRow(rIdx)} className="text-rose-500 hover:text-rose-700">
                                                        <Minus size={12} />
                                                    </button>
                                                ) : rIdx + 1}
                                            </td>
                                            {columns.map((_, cIdx) => (
                                                <td key={cIdx} className="px-2 py-1 border-r border-b border-violet-100 min-w-[130px]">
                                                    {editMode ? (
                                                        <input
                                                            value={row[cIdx] || ''}
                                                            onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                                                            className="w-full text-xs bg-transparent border-b border-transparent focus:border-violet-400 focus:outline-none px-1 py-0.5 text-slate-700 rounded transition-colors"
                                                            placeholder="—"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-slate-700 px-1">
                                                            {row[cIdx] || <span className="text-slate-300">—</span>}
                                                        </span>
                                                    )}
                                                </td>
                                            ))}
                                            {editMode && <td className="border-b border-violet-100" />}
                                        </tr>
                                    ))}
                                    {editMode && (
                                        <tr>
                                            <td colSpan={columns.length + 2} className="px-4 py-2">
                                                <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-violet-600 font-bold hover:text-violet-800 transition-colors">
                                                    <PlusCircle size={14} /> Add Row
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default MeetingWorkspace;
