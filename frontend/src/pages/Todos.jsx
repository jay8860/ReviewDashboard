import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowDown, ArrowUp, CheckCircle2, ClipboardList,
    RefreshCw, Trash2, Upload, FileUp, ArrowRightCircle, MapPin
} from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

const parseNotesLines = (raw = '') => {
    return (raw || '')
        .split('\n')
        .map((line) => line.trim())
        .map((line) => line.replace(/^[-*•\u2022]\s*/, '').replace(/^\d+[\).\-\s]+/, '').replace(/^\[[xX ]\]\s*/, '').trim())
        .filter(Boolean);
};

const getEmployeeDisplayLabel = (employee) => {
    const displayName = String(employee?.display_username || '').trim();
    if (displayName) return displayName;
    return String(employee?.name || '').trim() || `Employee ${employee?.id || ''}`.trim();
};

const Todos = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const toast = useToast();

    const [items, setItems] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [notesInput, setNotesInput] = useState('');
    const [importSelected, setImportSelected] = useState({});
    const [todoTaskOptions, setTodoTaskOptions] = useState({});

    const allSelected = useMemo(
        () => items.length > 0 && selectedIds.length === items.length,
        [items.length, selectedIds.length]
    );
    const sortedEmployees = useMemo(
        () => [...employees].sort((a, b) => getEmployeeDisplayLabel(a).localeCompare(getEmployeeDisplayLabel(b), undefined, { sensitivity: 'base' })),
        [employees]
    );
    const parsedNotesLines = useMemo(() => parseNotesLines(notesInput), [notesInput]);
    const allParsedSelected = useMemo(() => {
        if (parsedNotesLines.length === 0) return false;
        return parsedNotesLines.every((_, idx) => importSelected[idx] !== false);
    }, [parsedNotesLines, importSelected]);

    useEffect(() => {
        const next = {};
        parsedNotesLines.forEach((_, idx) => {
            next[idx] = true;
        });
        setImportSelected(next);
    }, [notesInput]);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [todoRows, employeeRows] = await Promise.all([
                api.getTodos(),
                api.getEmployees(),
            ]);
            setItems(todoRows || []);
            setEmployees(employeeRows || []);
            setSelectedIds(prev => prev.filter(id => (todoRows || []).some(item => item.id === id)));
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load to-do list');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const handleImportNotes = async () => {
        const selectedLines = parsedNotesLines.filter((line, idx) => importSelected[idx] !== false);
        if (selectedLines.length === 0) {
            toast.error('Select at least one parsed line to import');
            return;
        }
        try {
            const result = await api.importTodosFromText({
                text: selectedLines.join('\n'),
                priority: 'Normal',
            });
            const created = result?.items || [];
            if (created.length > 0) {
                setItems(prev => [...prev, ...created]);
            }
            toast.success(`${result?.created || 0} to-do items imported`);
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to import notes');
        }
    };

    const deleteSelected = async () => {
        if (selectedIds.length === 0) {
            toast.error('Select at least one item');
            return;
        }
        if (!window.confirm(`Delete ${selectedIds.length} selected to-do item(s)?`)) return;
        try {
            await Promise.all(selectedIds.map((id) => api.deleteTodo(id)));
            setItems((prev) => prev.filter((row) => !selectedIds.includes(row.id)));
            setSelectedIds([]);
            toast.success('Selected to-do items deleted');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed');
        }
    };

    const toggleSelected = (id) => {
        setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    };

    const toggleAll = () => {
        if (allSelected) {
            setSelectedIds([]);
            return;
        }
        setSelectedIds(items.map(item => item.id));
    };

    const updateInline = async (id, patch) => {
        try {
            const updated = await api.updateTodo(id, patch);
            setItems(prev => prev.map(item => (item.id === id ? updated : item)));
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Update failed');
        }
    };

    const removeItem = async (id) => {
        if (!window.confirm('Delete this to-do item?')) return;
        try {
            await api.deleteTodo(id);
            setItems(prev => prev.filter(item => item.id !== id));
            setSelectedIds(prev => prev.filter(x => x !== id));
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed');
        }
    };

    const moveItem = async (id, direction) => {
        const index = items.findIndex(item => item.id === id);
        if (index < 0) return;
        const target = index + direction;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        setItems(next);
        try {
            await api.reorderTodos(next.map(item => item.id));
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Reorder failed');
            loadAll();
        }
    };

    const convertOne = async (id) => {
        try {
            const rowOptions = todoTaskOptions[id] || {};
            const result = await api.convertTodoToTask(id, {
                assigned_employee_id: rowOptions.assigned_employee_id ? parseInt(rowOptions.assigned_employee_id, 10) : null,
            });
            const updatedTodo = result?.todo;
            if (updatedTodo) {
                setItems(prev => prev.map(item => (item.id === id ? updatedTodo : item)));
            }
            toast.success(`Converted to task ${result?.task_number || ''}`);
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Conversion failed');
        }
    };

    const convertSelected = async () => {
        if (selectedIds.length === 0) {
            toast.error('Select at least one item');
            return;
        }
        let converted = 0;
        for (const id of selectedIds) {
            try {
                const rowOptions = todoTaskOptions[id] || {};
                await api.convertTodoToTask(id, {
                    assigned_employee_id: rowOptions.assigned_employee_id ? parseInt(rowOptions.assigned_employee_id, 10) : null,
                });
                converted += 1;
            } catch (e) {
                console.error('Convert failed for todo', id, e);
            }
        }
        setSelectedIds([]);
        await loadAll();
        toast.success(`${converted} item(s) converted to tasks`);
    };

    const addTodoToFieldVisitNotepad = async (item) => {
        const text = String(item?.title || '').trim();
        if (!text) {
            toast.error('To-do item is empty');
            return;
        }
        try {
            await api.appendFieldVisitPlanningNoteLines([text]);
            toast.success('To-do added to Field Visit notepad');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to add to Field Visit notepad');
        }
    };

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="space-y-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-4xl font-black dark:text-white tracking-tight">To Do List</h1>
                        <p className="text-slate-500 mt-1">
                            Personal reminders + pasted Apple Notes checklist. Convert selected items into Tasks anytime.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadAll}
                            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold inline-flex items-center gap-1.5"
                        >
                            <RefreshCw size={14} /> Refresh
                        </button>
                        <button
                            onClick={() => navigate('/tasks')}
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold inline-flex items-center gap-1.5"
                        >
                            <ClipboardList size={14} /> Open Tasks
                        </button>
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                    <div className="glass-card rounded-3xl p-5 border border-indigo-100 lg:col-span-2">
                        <div className="flex items-center gap-2 mb-3">
                            <FileUp size={16} className="text-indigo-600" />
                            <h2 className="font-black text-slate-800">Paste Apple Notes To-Dos</h2>
                        </div>
                        <textarea
                            value={notesInput}
                            onChange={(e) => setNotesInput(e.target.value)}
                            rows={6}
                            placeholder={'Paste lines here...\n- Call CEO\n- Visit Anganwadi\n- Review MB pending list'}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white resize-none"
                        />
                        <div className="mt-2 p-3 rounded-xl border border-slate-200 bg-slate-50">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-bold text-slate-500">Parsed list preview ({parsedNotesLines.length})</p>
                                <label className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                                    <input
                                        type="checkbox"
                                        checked={allParsedSelected}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const next = {};
                                            parsedNotesLines.forEach((_, idx) => { next[idx] = checked; });
                                            setImportSelected(next);
                                        }}
                                    />
                                    Select all
                                </label>
                            </div>
                            <div className="max-h-24 overflow-y-auto text-sm text-slate-700 space-y-1">
                                {parsedNotesLines.length === 0 ? (
                                    <p className="text-slate-400 italic">No parsed lines yet</p>
                                ) : (
                                    parsedNotesLines.map((line, idx) => (
                                        <label key={`${idx}-${line}`} className="flex items-start gap-2">
                                            <input
                                                type="checkbox"
                                                className="mt-1"
                                                checked={importSelected[idx] !== false}
                                                onChange={(e) => setImportSelected((prev) => ({ ...prev, [idx]: e.target.checked }))}
                                            />
                                            <span>{idx + 1}. {line}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button
                                onClick={handleImportNotes}
                                className="px-4 py-2.5 rounded-xl bg-violet-600 text-white font-bold inline-flex items-center gap-1.5"
                            >
                                <Upload size={14} /> Import Lines
                            </button>
                        </div>
                    </div>
                </div>

                <div className="glass-card rounded-3xl overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-slate-800">All To-Do Items ({items.length})</h3>
                            <label className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1">
                                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                                Select all
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={deleteSelected}
                                className="px-3 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold inline-flex items-center gap-1.5"
                            >
                                <Trash2 size={14} /> Delete Selected
                            </button>
                            <button
                                onClick={convertSelected}
                                className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-1.5"
                            >
                                <ArrowRightCircle size={14} /> Convert Selected To Tasks
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-slate-400">Loading to-dos...</div>
                    ) : items.length === 0 ? (
                        <div className="p-8 text-slate-400">No to-dos yet.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {items.map((item, idx) => (
                                <div key={item.id} className="p-4">
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelected(item.id)}
                                                className="mt-1"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <input
                                                    value={item.title || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setItems(prev => prev.map(row => row.id === item.id ? { ...row, title: val } : row));
                                                    }}
                                                    onBlur={() => updateInline(item.id, { title: item.title || '' })}
                                                    className={`w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold ${item.status === 'Done' ? 'line-through text-slate-400' : 'text-slate-800'}`}
                                                />
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                    <select
                                                        value={todoTaskOptions[item.id]?.assigned_employee_id || item.assigned_employee_id || ''}
                                                        onChange={(e) => setTodoTaskOptions(prev => ({
                                                            ...prev,
                                                            [item.id]: {
                                                                ...(prev[item.id] || {}),
                                                                assigned_employee_id: e.target.value,
                                                            },
                                                        }))}
                                                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white"
                                                    >
                                                        <option value="">Task employee: none</option>
                                                        {sortedEmployees.map(emp => <option key={emp.id} value={emp.id}>{getEmployeeDisplayLabel(emp)}</option>)}
                                                    </select>
                                                    {item.linked_task_number && (
                                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                                                            Task: {item.linked_task_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => moveItem(item.id, -1)}
                                                disabled={idx === 0}
                                                className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                                                title="Move up"
                                            >
                                                <ArrowUp size={14} />
                                            </button>
                                            <button
                                                onClick={() => moveItem(item.id, 1)}
                                                disabled={idx === items.length - 1}
                                                className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                                                title="Move down"
                                            >
                                                <ArrowDown size={14} />
                                            </button>
                                            <button
                                                onClick={() => updateInline(item.id, { status: item.status === 'Done' ? 'Open' : 'Done' })}
                                                className={`p-2 rounded-lg border ${item.status === 'Done' ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-500'}`}
                                                title="Toggle done"
                                            >
                                                <CheckCircle2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => convertOne(item.id)}
                                                className="px-2.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                                                title="Convert to task"
                                            >
                                                To Task
                                            </button>
                                            <button
                                                onClick={() => addTodoToFieldVisitNotepad(item)}
                                                className="p-2 rounded-lg border border-emerald-200 text-emerald-600"
                                                title="Add to Field Visit notepad"
                                            >
                                                <MapPin size={14} />
                                            </button>
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="p-2 rounded-lg border border-rose-200 text-rose-500"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default Todos;
