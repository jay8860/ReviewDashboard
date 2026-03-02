import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Search, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import { canAccessModule } from '../utils/access';

const EmployeeModal = ({ isOpen, onClose, onSave, departments, initial }) => {
    const [form, setForm] = useState({
        name: '',
        mobile_number: '',
        display_username: '',
        department_id: ''
    });

    useEffect(() => {
        if (initial) {
            setForm({
                name: initial.name || '',
                mobile_number: initial.mobile_number || '',
                display_username: initial.display_username || '',
                department_id: initial.department_id || ''
            });
        } else {
            setForm({
                name: '',
                mobile_number: '',
                display_username: '',
                department_id: ''
            });
        }
    }, [initial, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5";

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-3xl p-8 w-full max-w-md shadow-premium-lg">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black dark:text-white">{initial ? 'Edit' : 'New'} Employee</h2>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={20} className="text-slate-400" /></button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className={labelCls}>Name *</label>
                            <input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Employee Full Name" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Mobile Number *</label>
                            <input required value={form.mobile_number} onChange={e => setForm({ ...form, mobile_number: e.target.value })}
                                placeholder="10-digit mobile number" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Display Username *</label>
                            <input required value={form.display_username} onChange={e => setForm({ ...form, display_username: e.target.value })}
                                placeholder="Username" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Department (Optional)</label>
                            <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} className={inputCls}>
                                <option value="">None</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20">
                                {initial ? 'Save' : 'Add Employee'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const Employees = ({ user, onLogout }) => {
    const toast = useToast();
    const canManageEmployees = canAccessModule(user, 'employees');
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editEmp, setEditEmp] = useState(null);

    const sortEmployeesByName = (rows = []) => (
        [...rows].sort((a, b) => (
            String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
        ))
    );

    const loadData = async () => {
        setLoading(true);
        try {
            const [emps, depts] = await Promise.all([
                api.getEmployees({ search, department_id: filterDept }),
                api.getDepartments()
            ]);
            setEmployees(sortEmployeesByName(emps || []));
            setDepartments(depts);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [search, filterDept]);

    const handleSave = async (form) => {
        try {
            const payload = { ...form };
            if (payload.department_id === '') payload.department_id = null;
            else if (payload.department_id) payload.department_id = parseInt(payload.department_id);

            if (editEmp) { await api.updateEmployee(editEmp.id, payload); toast.success('Employee updated'); }
            else { await api.createEmployee(payload); toast.success('Employee added'); }

            setModalOpen(false);
            setEditEmp(null);
            loadData();
        } catch (err) {
            toast.error('Error saving employee: ' + (err?.response?.data?.detail || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this employee?")) return;
        try {
            await api.deleteEmployee(id);
            toast.success('Employee deleted');
            loadData();
        } catch (err) {
            toast.error('Error deleting employee');
        }
    };

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tight">Employees</h1>
                    <p className="text-slate-500 dark:text-dark-muted mt-1">Manage personnel for task assignment</p>
                </div>
                {canManageEmployees && (
                    <button onClick={() => { setEditEmp(null); setModalOpen(true); }}
                        className="flex items-center gap-2 px-5 py-3 bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 transition-colors w-fit">
                        <Plus size={18} /> Add Employee
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="glass-card rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, username, or mobile..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all" />
                </div>
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button onClick={loadData} className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Table */}
            <div className="glass-card rounded-3xl overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-black">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Display Username</th>
                                <th className="px-6 py-4">Mobile</th>
                                <th className="px-6 py-4">Department</th>
                                {canManageEmployees && <th className="px-6 py-4 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <Users size={40} className="mx-auto text-slate-300 mb-3 opacity-50" />
                                        <p className="font-semibold text-lg">No employees found.</p>
                                    </td>
                                </tr>
                            ) : (
                                employees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-800 dark:text-white">{emp.name}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{emp.display_username}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{emp.mobile_number}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {emp.department_name ? (
                                                <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                                                    {emp.department_name}
                                                </span>
                                            ) : '--'}
                                        </td>
                                        {canManageEmployees && (
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditEmp(emp); setModalOpen(true); }}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(emp.id)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <EmployeeModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditEmp(null); }}
                onSave={handleSave}
                departments={departments}
                initial={editEmp}
            />
        </Layout>
    );
};

export default Employees;
