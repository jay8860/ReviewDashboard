import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowDown, ArrowUp, CheckCircle2, ClipboardList, Plus,
    RefreshCw, Trash2, Upload, FileUp, ArrowRightCircle
} from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

const PRIORITIES = ['Critical', 'High', 'Normal', 'Low'];

const Todos = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const toast = useToast();

    const [items, setItems] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [notesInput, setNotesInput] = useState('');
    const [form, setForm] = useState({
        title: '',
        details: '',
        due_date: '',
        department_id: '',
        priority: 'Normal',
    });

    const allSelected = useMemo(
        () => items.length > 0 && selectedIds.length === items.length,
        [items.length, selectedIds.length]
    );

    const loadAll = async () => {
        setLoading(true);
        try {
            const [todoRows, deptRows] = await Promise.all([
                api.getTodos(),
                api.getDepartments(),
            ]);
            setItems(todoRows || []);
            setDepartments(deptRows || []);
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

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) {
            toast.error('Title is required');
            return;
        }
        try {
            const created = await api.createTodo({
                ...form,
                title: form.title.trim(),
                due_date: form.due_date || null,
                department_id: form.department_id ? parseInt(form.department_id, 10) : null,
            });
            setItems(prev => [...prev, created]);
            setForm({
                title: '',
                details: '',
                due_date: '',
                department_id: '',
                priority: 'Normal',
            });
            toast.success('To-do item added');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to add to-do');
        }
    };

    const handleImportNotes = async () => {
        if (!notesInput.trim()) {
            toast.error('Paste notes first');
            return;
        }
        try {
            const result = await api.importTodosFromText({
                text: notesInput,
                priority: 'Normal',
            });
            const created = result?.items || [];
            if (created.length > 0) {
                setItems(prev => [...prev, ...created]);
            }
            setNotesInput('');
            toast.success(`${result?.created || 0} to-do items imported`);
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to import notes');
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
            const result = await api.convertTodoToTask(id, {});
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
                await api.convertTodoToTask(id, {});
                converted += 1;
            } catch (e) {
                console.error('Convert failed for todo', id, e);
            }
        }
        setSelectedIds([]);
        await loadAll();
        toast.success(`${converted} item(s) converted to tasks`);
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
                    <form onSubmit={handleAdd} className="glass-card rounded-3xl p-5 border border-indigo-100">
                        <div className="flex items-center gap-2 mb-3">
                            <Plus size={16} className="text-indigo-600" />
                            <h2 className="font-black text-slate-800">Add Reminder</h2>
                        </div>
                        <div className="space-y-3">
                            <input
                                value={form.title}
                                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Title (required)"
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                            />
                            <textarea
                                value={form.details}
                                onChange={(e) => setForm(prev => ({ ...prev, details: e.target.value }))}
                                rows={2}
                                placeholder="Details / context"
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white resize-none"
                            />
                            <div className="grid grid-cols-3 gap-2">
                                <input
                                    type="date"
                                    value={form.due_date}
                                    onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                                    className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                                />
                                <select
                                    value={form.priority}
                                    onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                                    className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                                >
                                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select
                                    value={form.department_id}
                                    onChange={(e) => setForm(prev => ({ ...prev, department_id: e.target.value }))}
                                    className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                                >
                                    <option value="">No department</option>
                                    {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end">
                                <button type="submit" className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold">
                                    Add To Do
                                </button>
                            </div>
                        </div>
                    </form>

                    <div className="glass-card rounded-3xl p-5 border border-indigo-100">
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
                        <button
                            onClick={convertSelected}
                            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-1.5"
                        >
                            <ArrowRightCircle size={14} /> Convert Selected To Tasks
                        </button>
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
                                                <textarea
                                                    rows={1}
                                                    value={item.details || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setItems(prev => prev.map(row => row.id === item.id ? { ...row, details: val } : row));
                                                    }}
                                                    onBlur={() => updateInline(item.id, { details: item.details || '' })}
                                                    placeholder="Details"
                                                    className="w-full mt-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 resize-none"
                                                />
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                    <select
                                                        value={item.priority || 'Normal'}
                                                        onChange={(e) => updateInline(item.id, { priority: e.target.value })}
                                                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white"
                                                    >
                                                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                    <input
                                                        type="date"
                                                        value={item.due_date || ''}
                                                        onChange={(e) => updateInline(item.id, { due_date: e.target.value || null })}
                                                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white"
                                                    />
                                                    <select
                                                        value={item.department_id || ''}
                                                        onChange={(e) => updateInline(item.id, { department_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                                                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white"
                                                    >
                                                        <option value="">No department</option>
                                                        {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
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
