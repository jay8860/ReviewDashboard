import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Plus, Trash2, Edit2, ArrowRight, X,
    AlertTriangle, CheckCircle2, Clock, BookOpen
} from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';

const COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal', 'orange'];

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

const HealthIcon = ({ status }) => {
    if (status === 'ok') return <CheckCircle2 size={16} className="text-emerald-500" />;
    if (status === 'warning') return <Clock size={16} className="text-amber-500" />;
    if (status === 'critical') return <AlertTriangle size={16} className="text-rose-500" />;
    return <BookOpen size={16} className="text-slate-400" />;
};

const DeptModal = ({ isOpen, onClose, onSave, initial = null }) => {
    const [form, setForm] = useState({
        name: '', short_name: '', description: '',
        head_name: '', head_designation: '', color: 'indigo'
    });

    useEffect(() => {
        if (initial) setForm({ ...form, ...initial });
        else setForm({ name: '', short_name: '', description: '', head_name: '', head_designation: '', color: 'indigo' });
    }, [initial, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-md shadow-premium-lg"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">{initial ? 'Edit' : 'New'} Department</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Department Name *</label>
                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Education Department"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Short Name</label>
                                <input value={form.short_name} onChange={e => setForm({ ...form, short_name: e.target.value })}
                                    placeholder="e.g. EDU"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Color</label>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {COLORS.map(c => (
                                        <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                                            className={`w-6 h-6 rounded-full bg-gradient-to-br ${colorGrad[c]} transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-60 hover:opacity-100'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Nodal Officer / Head</label>
                            <input value={form.head_name} onChange={e => setForm({ ...form, head_name: e.target.value })}
                                placeholder="Name"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Designation</label>
                            <input value={form.head_designation} onChange={e => setForm({ ...form, head_designation: e.target.value })}
                                placeholder="e.g. District Education Officer"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Description</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={2} placeholder="Brief description..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20">
                                {initial ? 'Save Changes' : 'Create'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const Departments = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editDept, setEditDept] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            setDepartments(await api.getDepartments());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleSave = async (form) => {
        try {
            if (editDept) {
                await api.updateDepartment(editDept.id, form);
            } else {
                await api.createDepartment(form);
            }
            setModalOpen(false);
            setEditDept(null);
            load();
        } catch (e) {
            alert('Error saving department');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this department and all its programs/sessions?')) return;
        await api.deleteDepartment(id);
        load();
    };

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tight">Departments</h1>
                    <p className="text-slate-500 dark:text-dark-muted mt-1 font-medium">Manage departments and their review programs</p>
                </div>
                <button
                    onClick={() => { setEditDept(null); setModalOpen(true); }}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-700 text-white rounded-full font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 transition-all hover:scale-105"
                >
                    <Plus size={18} strokeWidth={3} /> New Department
                </button>
            </div>

            {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => <div key={i} className="glass-card rounded-3xl h-48 animate-pulse" />)}
                </div>
            ) : departments.length === 0 ? (
                <div className="glass-card rounded-3xl p-16 text-center">
                    <Building2 size={56} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-xl font-black text-slate-400">No departments yet</p>
                    <p className="text-slate-400 mt-1 mb-6">Add your first department to get started</p>
                    <button onClick={() => { setEditDept(null); setModalOpen(true); }}
                        className="px-6 py-3 bg-indigo-700 text-white rounded-2xl font-bold shadow-lg">
                        <Plus size={16} className="inline mr-2" /> Add Department
                    </button>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {departments.map((dept, i) => (
                        <motion.div
                            key={dept.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="glass-card rounded-3xl overflow-hidden group hover:shadow-premium transition-premium"
                        >
                            {/* Top colored strip */}
                            <div className={`h-2 bg-gradient-to-r ${colorGrad[dept.color] || colorGrad.indigo}`} />
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colorGrad[dept.color] || colorGrad.indigo} flex items-center justify-center shadow-lg`}>
                                        <span className="text-white font-black text-sm">
                                            {dept.short_name || dept.name.slice(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditDept(dept); setModalOpen(true); }}
                                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors">
                                            <Edit2 size={15} />
                                        </button>
                                        <button onClick={() => handleDelete(dept.id)}
                                            className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="font-black text-lg text-slate-800 dark:text-white mb-1 leading-tight">{dept.name}</h3>
                                {dept.head_name && (
                                    <p className="text-xs text-slate-400 mb-3">{dept.head_name} · {dept.head_designation}</p>
                                )}

                                <div className="flex items-center gap-2 mb-4">
                                    <HealthIcon status={dept.review_health?.status} />
                                    <span className="text-xs font-semibold text-slate-500">
                                        {dept.program_count} program{dept.program_count !== 1 ? 's' : ''}
                                        {dept.review_health?.overdue_reviews > 0 && (
                                            <span className="text-rose-500 ml-2">· {dept.review_health.overdue_reviews} overdue</span>
                                        )}
                                    </span>
                                    {dept.open_tasks > 0 && (
                                        <span className="text-xs text-slate-400 ml-auto">{dept.open_tasks} tasks</span>
                                    )}
                                </div>

                                <button
                                    onClick={() => navigate(`/departments/${dept.id}`)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 transition-colors group/btn"
                                >
                                    View Programs & Reviews
                                    <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <DeptModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditDept(null); }}
                onSave={handleSave}
                initial={editDept}
            />
        </Layout>
    );
};

export default Departments;
