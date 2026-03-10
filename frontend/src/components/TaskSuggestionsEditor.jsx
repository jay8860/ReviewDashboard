import React, { useMemo, useState } from 'react';
import { Brain, CheckSquare, Loader2, PlusCircle, Trash2, WandSparkles } from 'lucide-react';
import { useToast } from './Toast';
import EmployeeSearchSelect from './EmployeeSearchSelect';

const defaultRow = (idx = 1) => ({
    _id: `row-${Date.now()}-${idx}`,
    selected: true,
    description: '',
    assigned_agency: '',
    assigned_employee_id: '',
    priority: 'Normal',
    deadline_date: '',
    time_given: '',
    remarks: '',
    is_pinned: false,
    is_today: false,
    source_snippet: '',
    confidence: null,
    duplicate_of_task_id: null,
    duplicate_reason: null,
});

const normalizeRows = (items = []) =>
    (items || []).map((item, idx) => ({
        ...defaultRow(idx + 1),
        ...item,
        _id: item.id || `row-${Date.now()}-${idx + 1}`,
        selected: item.selected !== false,
        description: item.description || '',
        assigned_agency: item.assigned_agency || '',
        assigned_employee_id: item.assigned_employee_id || '',
        priority: item.priority || 'Normal',
        deadline_date: item.deadline_date || '',
        time_given: item.time_given || '',
        remarks: item.remarks || '',
        is_pinned: !!item.is_pinned,
        is_today: !!item.is_today,
        source_snippet: item.source_snippet || '',
        confidence: typeof item.confidence === 'number' ? item.confidence : null,
    }));

const TaskSuggestionsEditor = ({
    title = 'AI Task Suggestions',
    subtitle = 'Generate, review, edit, and create tasks only after confirmation.',
    onGenerate,
    onConfirmCreate,
    generateLabel = 'Generate Suggestions',
    employees = [],
    className = '',
}) => {
    const toast = useToast();
    const [rows, setRows] = useState([]);
    const [sourceName, setSourceName] = useState('');
    const [generating, setGenerating] = useState(false);
    const [creating, setCreating] = useState(false);

    const selectedCount = useMemo(
        () => rows.filter(r => r.selected && (r.description || '').trim().length >= 6).length,
        [rows]
    );
    const employeeOptions = useMemo(() => {
        const normalized = (employees || [])
            .filter((emp) => Number.isFinite(Number(emp?.id)))
            .map((emp) => ({
                id: Number(emp.id),
                name: String(emp.name || '').trim() || `Employee ${emp.id}`,
                display_username: String(emp.display_username || '').trim(),
            }));
        normalized.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        return normalized;
    }, [employees]);

    const updateRow = (rowId, key, value) => {
        setRows(prev => prev.map(r => (r._id === rowId ? { ...r, [key]: value } : r)));
    };

    const removeRow = (rowId) => {
        setRows(prev => prev.filter(r => r._id !== rowId));
    };

    const addRow = () => {
        setRows(prev => [...prev, defaultRow(prev.length + 1)]);
    };

    const generate = async () => {
        if (!onGenerate) return;
        setGenerating(true);
        try {
            const result = await onGenerate();
            const items = normalizeRows(result?.suggestions || []);
            setRows(items);
            setSourceName(result?.source_name || '');
            toast.success(`Generated ${items.length} suggestions`);
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to generate task suggestions';
            toast.error(msg);
        } finally {
            setGenerating(false);
        }
    };

    const createSelected = async () => {
        if (!onConfirmCreate) return;
        const selected = rows.filter(r => r.selected && (r.description || '').trim().length >= 6);
        if (!selected.length) {
            toast.error('Select at least one valid suggestion');
            return;
        }
        setCreating(true);
        try {
            const payload = selected.map(r => ({
                selected: true,
                description: r.description.trim(),
                assigned_agency: (r.assigned_agency || '').trim() || null,
                assigned_employee_id: r.assigned_employee_id ? Number(r.assigned_employee_id) : null,
                priority: r.priority || 'Normal',
                deadline_date: r.deadline_date || null,
                time_given: (r.time_given || '').trim() || null,
                remarks: (r.remarks || '').trim() || null,
                is_pinned: !!r.is_pinned,
                is_today: !!r.is_today,
                source_snippet: (r.source_snippet || '').trim() || null,
            }));
            const result = await onConfirmCreate(payload);
            const createdCount = result?.created_count ?? 0;
            const skippedCount = result?.skipped_count ?? 0;
            toast.success(`Created ${createdCount} task(s)${skippedCount ? `, skipped ${skippedCount}` : ''}`);
            setRows(prev => prev.map(r => (selected.find(s => s._id === r._id) ? { ...r, selected: false } : r)));
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to create tasks';
            toast.error(msg);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className={`glass-card rounded-3xl overflow-hidden border border-violet-100/70 dark:border-violet-500/20 ${className}`}>
            <div className="px-5 py-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <WandSparkles size={16} className="text-violet-600" /> {title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                        {sourceName ? <p className="text-[11px] text-violet-700 mt-1 font-semibold">Source: {sourceName}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={generate}
                            disabled={generating}
                            className="px-3 py-2 rounded-xl bg-indigo-100 text-indigo-700 text-xs font-black hover:bg-indigo-200 transition-colors disabled:opacity-60 inline-flex items-center gap-1"
                        >
                            {generating ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
                            {generating ? 'Generating…' : generateLabel}
                        </button>
                        <button
                            onClick={createSelected}
                            disabled={creating || selectedCount === 0}
                            className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-black hover:bg-violet-700 transition-colors disabled:opacity-60 inline-flex items-center gap-1"
                        >
                            {creating ? <Loader2 size={13} className="animate-spin" /> : <CheckSquare size={13} />}
                            {creating ? 'Creating…' : `Create Selected (${selectedCount})`}
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-white/95">
                {rows.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No suggestions yet. Click "{generateLabel}" to generate.</p>
                ) : (
                    <div className="space-y-3 max-h-[420px] overflow-auto custom-scrollbar">
                        {rows.map((row, idx) => (
                            <div key={row._id} className="rounded-2xl border border-violet-100 bg-violet-50/35 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={!!row.selected}
                                            onChange={(e) => updateRow(row._id, 'selected', e.target.checked)}
                                            className="rounded border-violet-300 text-violet-600 focus:ring-violet-400"
                                        />
                                        Suggestion {idx + 1}
                                    </label>
                                    <button
                                        onClick={() => removeRow(row._id)}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700"
                                    >
                                        <Trash2 size={12} /> Remove
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                                    <input
                                        value={row.description}
                                        onChange={(e) => updateRow(row._id, 'description', e.target.value)}
                                        placeholder="Task description"
                                        className="md:col-span-2 px-2.5 py-2 rounded-lg border border-violet-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    />
                                    <input
                                        value={row.assigned_agency}
                                        onChange={(e) => updateRow(row._id, 'assigned_agency', e.target.value)}
                                        placeholder="Assigned agency / owner"
                                        className="px-2.5 py-2 rounded-lg border border-violet-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    />
                                    <EmployeeSearchSelect
                                        employees={employeeOptions}
                                        value={row.assigned_employee_id || ''}
                                        onChange={(nextId) => updateRow(row._id, 'assigned_employee_id', nextId)}
                                        placeholder="Search name/designation"
                                        noneLabel="Assign to employee"
                                        inputClassName="px-2.5 py-2 rounded-lg border border-violet-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    />
                                    <select
                                        value={row.priority}
                                        onChange={(e) => updateRow(row._id, 'priority', e.target.value)}
                                        className="px-2.5 py-2 rounded-lg border border-violet-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    >
                                        <option value="Critical">Critical</option>
                                        <option value="High">High</option>
                                        <option value="Normal">Normal</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-2">
                                    <input
                                        type="date"
                                        value={row.deadline_date || ''}
                                        onChange={(e) => updateRow(row._id, 'deadline_date', e.target.value)}
                                        className="px-2.5 py-2 rounded-lg border border-violet-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    />
                                    <input
                                        value={row.time_given}
                                        onChange={(e) => updateRow(row._id, 'time_given', e.target.value)}
                                        placeholder="Time given (defaults to 7 days)"
                                        className="px-2.5 py-2 rounded-lg border border-violet-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    />
                                    <label className="inline-flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-violet-200 bg-white text-xs text-slate-700 font-semibold">
                                        Important
                                        <input
                                            type="checkbox"
                                            checked={!!row.is_pinned}
                                            onChange={(e) => updateRow(row._id, 'is_pinned', e.target.checked)}
                                            className="rounded border-violet-300 text-violet-600 focus:ring-violet-400"
                                        />
                                    </label>
                                    <label className="inline-flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-violet-200 bg-white text-xs text-slate-700 font-semibold">
                                        Today
                                        <input
                                            type="checkbox"
                                            checked={!!row.is_today}
                                            onChange={(e) => updateRow(row._id, 'is_today', e.target.checked)}
                                            className="rounded border-violet-300 text-violet-600 focus:ring-violet-400"
                                        />
                                    </label>
                                    <input
                                        value={row.remarks}
                                        onChange={(e) => updateRow(row._id, 'remarks', e.target.value)}
                                        placeholder="Expected outcome / remarks"
                                        className="md:col-span-2 px-2.5 py-2 rounded-lg border border-violet-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    />
                                </div>

                                {(row.source_snippet || row.duplicate_reason || row.confidence !== null) ? (
                                    <div className="rounded-xl border border-violet-100 bg-white px-2.5 py-2">
                                        {row.source_snippet ? <p className="text-[11px] text-slate-600"><span className="font-black text-violet-600">Evidence:</span> {row.source_snippet}</p> : null}
                                        {row.confidence !== null ? <p className="text-[11px] text-slate-500 mt-1"><span className="font-black">Confidence:</span> {Math.round((row.confidence || 0) * 100)}%</p> : null}
                                        {row.duplicate_reason ? (
                                            <p className="text-[11px] text-amber-700 mt-1">
                                                <span className="font-black">Possible duplicate:</span> {row.duplicate_reason}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        ))}

                        <button
                            onClick={addRow}
                            className="w-full py-2 rounded-xl border border-dashed border-violet-300 text-xs font-bold text-violet-700 hover:bg-violet-50 inline-flex items-center justify-center gap-1"
                        >
                            <PlusCircle size={13} /> Add Manual Suggestion
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskSuggestionsEditor;
