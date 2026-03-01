import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, UserCog, X } from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

const UserModal = ({ isOpen, onClose, onSave, moduleOptions, initial }) => {
    const defaultModules = ['tasks', 'employees'];
    const [form, setForm] = useState({
        username: '',
        password: '',
        role: 'user',
        email: '',
        hint: '',
        module_access: defaultModules,
    });

    useEffect(() => {
        if (!isOpen) return;
        if (initial) {
            setForm({
                username: initial.username || '',
                password: '',
                role: initial.role || 'user',
                email: initial.email || '',
                hint: initial.hint || '',
                module_access: Array.isArray(initial.module_access) && initial.module_access.length > 0
                    ? initial.module_access
                    : defaultModules,
            });
        } else {
            setForm({
                username: '',
                password: '',
                role: 'user',
                email: '',
                hint: '',
                module_access: defaultModules,
            });
        }
    }, [initial, isOpen]);

    if (!isOpen) return null;

    const allModuleKeys = moduleOptions.map((item) => item.key);
    const editableModules = moduleOptions;

    const toggleModule = (moduleKey) => {
        setForm((prev) => {
            const hasItem = prev.module_access.includes(moduleKey);
            if (hasItem) {
                return { ...prev, module_access: prev.module_access.filter((item) => item !== moduleKey) };
            }
            return { ...prev, module_access: [...prev.module_access, moduleKey] };
        });
    };

    const handleRoleChange = (role) => {
        if (role === 'admin') {
            setForm((prev) => ({ ...prev, role, module_access: allModuleKeys }));
            return;
        }
        setForm((prev) => ({
            ...prev,
            role,
            module_access: prev.module_access,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            username: form.username.trim(),
            role: form.role,
            email: form.email.trim() || null,
            hint: form.hint.trim() || null,
            module_access: form.role === 'admin' ? allModuleKeys : form.module_access,
        };
        if (!initial || form.password.trim()) payload.password = form.password.trim();
        onSave(payload);
    };

    const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm';
    const labelCls = 'block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    className="glass-card rounded-3xl w-full max-w-2xl shadow-premium-lg"
                >
                    <div className="px-7 py-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black dark:text-white">{initial ? 'Edit User Access' : 'Create User'}</h2>
                            <p className="text-sm text-slate-500 mt-1">Set login credentials and module visibility.</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">
                            <X size={18} className="text-slate-400" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-7 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Username *</label>
                                <input
                                    required
                                    value={form.username}
                                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                                    className={inputCls}
                                    placeholder="e.g. officer1"
                                />
                            </div>
                            <div>
                                <label className={labelCls}>{initial ? 'New Password (Optional)' : 'Password *'}</label>
                                <input
                                    required={!initial}
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                                    className={inputCls}
                                    placeholder={initial ? 'Leave blank to keep current password' : 'Set password'}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Role</label>
                                <select
                                    value={form.role}
                                    onChange={(e) => handleRoleChange(e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Email (Optional)</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                    className={inputCls}
                                    placeholder="user@district.gov"
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Hint (Optional)</label>
                            <input
                                value={form.hint}
                                onChange={(e) => setForm((prev) => ({ ...prev, hint: e.target.value }))}
                                className={inputCls}
                                placeholder="Hint shown on login page"
                            />
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/70 dark:bg-white/5">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Module Access</p>
                            {form.role === 'admin' ? (
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                    Admin users automatically get access to all modules.
                                </p>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {editableModules.map((module) => {
                                        const checked = form.module_access.includes(module.key);
                                        return (
                                            <button
                                                type="button"
                                                key={module.key}
                                                onClick={() => toggleModule(module.key)}
                                                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors text-left ${checked
                                                    ? 'bg-indigo-700 text-white border-indigo-700'
                                                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-indigo-300'
                                                    }`}
                                            >
                                                {module.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                {initial ? 'Save User' : 'Create User'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const AccessModule = ({ user, onLogout }) => {
    const toast = useToast();
    const [users, setUsers] = useState([]);
    const [moduleOptions, setModuleOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const modules = await api.getAccessModules();
            setModuleOptions(modules);
            const userRows = await api.getUsers();
            setUsers(userRows);
        } catch (error) {
            if (error?.response?.status !== 401) {
                toast.error(error?.response?.data?.detail || 'Failed to load access module data');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const moduleMap = useMemo(() => {
        const map = {};
        for (const item of moduleOptions) map[item.key] = item.label;
        return map;
    }, [moduleOptions]);

    const handleSave = async (payload) => {
        try {
            if (editUser) {
                await api.updateUser(editUser.id, payload);
                toast.success('User updated');
            } else {
                await api.createUser(payload);
                toast.success('User created');
            }
            setModalOpen(false);
            setEditUser(null);
            loadData();
        } catch (error) {
            toast.error(error?.response?.data?.detail || 'Failed to save user');
        }
    };

    const handleDelete = async (target) => {
        if (!window.confirm(`Delete user "${target.username}"?`)) return;
        try {
            await api.deleteUser(target.id);
            toast.success('User deleted');
            loadData();
        } catch (error) {
            toast.error(error?.response?.data?.detail || 'Failed to delete user');
        }
    };

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tight">Access Module</h1>
                    <p className="text-slate-500 dark:text-dark-muted mt-1">
                        Create dashboard users and assign module-specific access.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadData}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-white/5 text-slate-700 dark:text-white font-bold rounded-full shadow-sm border border-slate-200 dark:border-white/10"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={() => {
                            setEditUser(null);
                            setModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-700 text-white font-bold rounded-full shadow-lg shadow-indigo-500/20 hover:bg-indigo-800 transition-colors"
                    >
                        <Plus size={16} /> New User
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-indigo-600" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">{users.length} user accounts</span>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-black">
                            <tr>
                                <th className="px-6 py-4">Username</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Modules</th>
                                <th className="px-6 py-4">Hint</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">Loading users...</td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">No users found.</td>
                                </tr>
                            ) : (
                                users.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-black text-slate-800 dark:text-white">{row.username}</p>
                                            {row.email && <p className="text-xs text-slate-400 mt-0.5">{row.email}</p>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wide ${row.role === 'admin'
                                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                                                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                                                }`}>
                                                {row.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[460px]">
                                                {(row.module_access || []).map((moduleKey) => (
                                                    <span key={moduleKey} className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                                                        {moduleMap[moduleKey] || moduleKey}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 max-w-[240px] truncate">{row.hint || '—'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        setEditUser(row);
                                                        setModalOpen(true);
                                                    }}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                    title="Edit"
                                                >
                                                    <UserCog size={15} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(row)}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditUser(row);
                                                        setModalOpen(true);
                                                    }}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                                    title="Reset password / role / modules"
                                                >
                                                    <KeyRound size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <UserModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditUser(null);
                }}
                onSave={handleSave}
                moduleOptions={moduleOptions}
                initial={editUser}
            />
        </Layout>
    );
};

export default AccessModule;
