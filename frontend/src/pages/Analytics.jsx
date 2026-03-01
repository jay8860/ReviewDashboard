import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    BarChart3, RefreshCw, AlertCircle, Activity, ListChecks,
} from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis,
} from 'recharts';

import Layout from '../components/Layout';
import { api } from '../services/api';

const cardClass = 'glass-card rounded-3xl p-6';

const ChartCard = ({ title, subtitle, children, footer }) => (
    <div className={cardClass}>
        <div className="mb-4">
            <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{subtitle}</p>}
        </div>
        <div>{children}</div>
        {footer && <div className="mt-4">{footer}</div>}
    </div>
);

const formatDays = (days) => {
    if (days === null || days === undefined) return '-';
    return `${days} day${days === 1 ? '' : 's'}`;
};

const Analytics = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState({
        summary: { total: 0, completed: 0, pending: 0, overdue: 0, in_progress: 0 },
        health: [],
        critical_bottlenecks: [],
        highest_workload: [],
        oldest_pending: [],
        agency_performance: [],
        generated_at: null,
    });

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const data = await api.getTaskAnalytics();
            setAnalytics(data || {});
        } catch (err) {
            console.error('Failed to load analytics', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, []);

    const goToTasks = (params = {}) => {
        const qp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && String(v).trim() !== '') qp.append(k, v);
        });
        const query = qp.toString();
        navigate(query ? `/tasks?${query}` : '/tasks');
    };

    const healthData = analytics.health || [];
    const bottlenecks = analytics.critical_bottlenecks || [];
    const workload = analytics.highest_workload || [];
    const oldestPending = analytics.oldest_pending || [];
    const agencyPerformance = analytics.agency_performance || [];

    const totalTasks = analytics.summary?.total || 0;

    const hasAnyData = useMemo(() => (
        totalTasks > 0 || bottlenecks.length > 0 || workload.length > 0 || oldestPending.length > 0 || agencyPerformance.length > 0
    ), [totalTasks, bottlenecks.length, workload.length, oldestPending.length, agencyPerformance.length]);

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Command Center</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Task analytics and bottleneck detection</p>
                </div>
                <button
                    onClick={loadAnalytics}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 transition-colors"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="grid lg:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="glass-card rounded-3xl h-[340px] animate-pulse" />)}
                </div>
            ) : !hasAnyData ? (
                <div className="glass-card rounded-3xl p-12 text-center">
                    <AlertCircle size={36} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-lg font-bold text-slate-500">No task analytics available yet</p>
                    <p className="text-sm text-slate-400 mt-1">Add tasks first, then analytics will populate automatically.</p>
                </div>
            ) : (
                <>
                    <div className="grid lg:grid-cols-2 gap-6 mb-6">
                        <ChartCard title="Project Health" subtitle="Click slices to open filtered task list">
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={healthData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={72}
                                            outerRadius={110}
                                            paddingAngle={2}
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                            onClick={(slice) => {
                                                const target = slice?.payload || slice;
                                                if (target?.status_filter) goToTasks({ status: target.status_filter });
                                            }}
                                        >
                                            {healthData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} className="cursor-pointer" />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                                {healthData.map(item => (
                                    <button
                                        key={item.name}
                                        type="button"
                                        onClick={() => goToTasks({ status: item.status_filter })}
                                        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                                    >
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span>{item.name}: {item.value}</span>
                                    </button>
                                ))}
                            </div>
                        </ChartCard>

                        <ChartCard title="Critical Bottlenecks" subtitle="Click bars to open agency tasks">
                            <div className="h-[330px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={bottlenecks} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis type="category" dataKey="agency" width={140} tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar
                                            dataKey="count"
                                            fill="#ef4444"
                                            radius={[8, 8, 8, 8]}
                                            onClick={(entry) => {
                                                const target = entry?.payload || entry;
                                                if (target?.agency) goToTasks({ agency: target.agency, status: 'Overdue' });
                                            }}
                                            className="cursor-pointer"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Highest Workload" subtitle="Click bars to open active tasks">
                            <div className="h-[330px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={workload} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis type="category" dataKey="agency" width={140} tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar
                                            dataKey="count"
                                            fill="#f59e0b"
                                            radius={[8, 8, 8, 8]}
                                            onClick={(entry) => {
                                                const target = entry?.payload || entry;
                                                if (target?.agency) goToTasks({ agency: target.agency, status: 'Pending,In Progress,Overdue' });
                                            }}
                                            className="cursor-pointer"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Top 10 Oldest Pending Tasks" subtitle="Click item to open in Tasks">
                            <div className="max-h-[330px] overflow-y-auto custom-scrollbar pr-1 space-y-3">
                                {oldestPending.length === 0 ? (
                                    <p className="text-slate-400 italic">No pending tasks.</p>
                                ) : oldestPending.map((item) => (
                                    <motion.button
                                        key={item.id}
                                        whileHover={{ y: -1 }}
                                        onClick={() => goToTasks({ search: item.task_number || item.description })}
                                        className="w-full text-left rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-3 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-slate-800 dark:text-white font-bold leading-snug">
                                                    {item.task_number ? `#${item.task_number} · ` : ''}{item.description}
                                                </p>
                                                <p className="text-sm text-slate-500 mt-0.5">{item.agency}</p>
                                            </div>
                                            <div className="text-rose-500 font-black whitespace-nowrap">{item.days_open} days</div>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </ChartCard>
                    </div>

                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-4 gap-4">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">Detailed Agency Performance</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Click rows to open agency task list</p>
                            </div>
                            <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <BarChart3 size={14} />
                                Updated
                                <span className="text-slate-500 normal-case tracking-normal">{analytics.generated_at ? new Date(analytics.generated_at).toLocaleString() : '-'}</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px]">
                                <thead>
                                    <tr className="text-left text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/10">
                                        <th className="py-3 pr-4">Agency</th>
                                        <th className="py-3 pr-4">Total</th>
                                        <th className="py-3 pr-4 text-emerald-600">Completed</th>
                                        <th className="py-3 pr-4 text-amber-600">Pending</th>
                                        <th className="py-3 pr-4 text-indigo-600">In Progress</th>
                                        <th className="py-3 pr-4 text-rose-600">Overdue</th>
                                        <th className="py-3">Avg Speed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agencyPerformance.map((row) => (
                                        <tr
                                            key={row.agency}
                                            className="border-b border-slate-100 dark:border-white/5 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/5 cursor-pointer transition-colors"
                                            onClick={() => goToTasks({ agency: row.agency })}
                                        >
                                            <td className="py-3 pr-4 font-bold text-slate-800 dark:text-white">{row.agency}</td>
                                            <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">{row.total}</td>
                                            <td className="py-3 pr-4 text-emerald-600 font-bold">{row.completed}</td>
                                            <td className="py-3 pr-4 text-amber-600 font-bold">{row.pending}</td>
                                            <td className="py-3 pr-4 text-indigo-600 font-bold">{row.in_progress}</td>
                                            <td className="py-3 pr-4 text-rose-600 font-bold">{row.overdue}</td>
                                            <td className="py-3 text-slate-600 dark:text-slate-300">{formatDays(row.avg_speed_days)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {!loading && hasAnyData && (
                <div className="mt-6 grid md:grid-cols-3 gap-4">
                    <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><Activity size={18} /></div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400 font-black">Completed</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-white">{analytics.summary?.completed || 0}</p>
                        </div>
                    </div>
                    <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center"><AlertCircle size={18} /></div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400 font-black">Overdue</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-white">{analytics.summary?.overdue || 0}</p>
                        </div>
                    </div>
                    <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><ListChecks size={18} /></div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400 font-black">Open Workload</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-white">{(analytics.summary?.pending || 0) + (analytics.summary?.in_progress || 0) + (analytics.summary?.overdue || 0)}</p>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Analytics;
