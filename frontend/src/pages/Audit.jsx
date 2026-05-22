import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

const Audit = ({ user, onLogout }) => {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [actor, setActor] = useState('');
    const [action, setAction] = useState('');
    const [query, setQuery] = useState('');

    const canAdmin = user?.role === 'admin';

    const load = async () => {
        setLoading(true);
        try {
            if (!canAdmin) {
                setRows(await api.getAuditMe(150));
                return;
            }
            setRows(await api.getAuditAdmin({
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                actor: actor || undefined,
                action: action || undefined,
                q: query || undefined,
                limit: 400,
            }));
        } catch (err) {
            toast.error(err?.response?.data?.detail || err.message || 'Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []); // initial

    const actions = useMemo(() => ([
        { value: '', label: 'All actions' },
        { value: 'created', label: 'Created' },
        { value: 'updated', label: 'Updated' },
        { value: 'completed', label: 'Completed' },
        { value: 'deleted', label: 'Deleted' },
    ]), []);

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="px-6 py-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 dark:text-white">Audit Log</h1>
                        <p className="text-xs text-slate-400 mt-1">
                            {canAdmin ? 'All task activity across users.' : 'Your task activity.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={load}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>

                {canAdmin && (
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Start</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-white/10 text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">End</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-white/10 text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Actor</label>
                            <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="username"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-white/10 text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Action</label>
                            <select value={action} onChange={(e) => setAction(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-white/10 text-sm">
                                {actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Search</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="text"
                                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-white/10 text-sm" />
                            </div>
                        </div>
                        <div className="md:col-span-5">
                            <button
                                type="button"
                                onClick={load}
                                className="px-4 py-2 rounded-xl bg-indigo-700 text-white text-sm font-black hover:bg-indigo-800"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-6 overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                                <th className="px-3 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400 w-44">When</th>
                                <th className="px-3 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400 w-28">Action</th>
                                <th className="px-3 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400 w-36">Actor</th>
                                <th className="px-3 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400 w-24">Task ID</th>
                                <th className="px-3 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400">Summary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {loading ? (
                                <tr><td className="px-3 py-4 text-slate-400" colSpan={5}>Loading…</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td className="px-3 py-4 text-slate-400" colSpan={5}>No audit entries.</td></tr>
                            ) : rows.map((r) => (
                                <tr key={r.id}>
                                    <td className="px-3 py-3 text-xs text-slate-500">{r.created_at || '-'}</td>
                                    <td className="px-3 py-3">
                                        <span className="text-[11px] font-black px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                                            {r.action}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-xs text-slate-700 dark:text-slate-200">{r.actor_username || '-'}</td>
                                    <td className="px-3 py-3 text-xs font-mono text-slate-600">{r.target_id ?? '-'}</td>
                                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{r.summary || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default Audit;

