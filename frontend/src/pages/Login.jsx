import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, Calendar as CalendarIcon, Moon, Sun } from 'lucide-react';

import { api } from '../services/api';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('admin');
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(false);

    const [showForgot, setShowForgot] = useState(false);
    const [email, setEmail] = useState('');
    const [hint, setHint] = useState('');
    const [error, setError] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setHint('');

        if (role === 'viewer') {
            const user = { username, role };
            localStorage.setItem('user', JSON.stringify(user));
            onLogin(user);
            navigate('/');
        } else {
            setLoading(true);
            try {
                const data = await api.login({ username, password });
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('token', data.access_token);
                onLogin(data.user);
                navigate('/');
            } catch (err) {
                setError("Invalid credentials.");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleForgot = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.forgotPassword(email);
            alert("If registered, a reset link has been sent to your email.");
            setShowForgot(false);
        } catch (e) {
            alert("Error sending link.");
        } finally {
            setLoading(false);
        }
    };

    const fetchHint = async () => {
        if (!username) return setError("Enter username first.");
        try {
            const data = await api.getHint(username);
            setHint(data.hint);
        } catch (e) {
            setHint("No hint available.");
        }
    };

    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
            {/* Left Side - Branding */}
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                className="md:w-1/2 bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 text-white p-12 flex flex-col relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-full bg-pattern opacity-10 pointer-events-none"></div>

                {/* Branding */}
                <div className="flex flex-col items-center gap-3 z-10 mt-8">
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm shadow-inner">
                        <span className="text-3xl font-bold tracking-tight">DA</span>
                    </div>
                    <span className="text-xl font-medium opacity-90 tracking-wide uppercase">District Administration</span>
                </div>

                {/* Center Content */}
                <div className="flex-1 flex flex-col justify-center items-center z-10 text-center">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 tracking-tight drop-shadow-sm">
                            Task <br /> Dashboard
                        </h1>
                        <div className="h-1 w-24 bg-violet-400 mx-auto rounded-full mb-6 opacity-80"></div>
                        <p className="opacity-80 text-lg font-medium leading-relaxed">
                            Centralized task monitoring &<br />management portal
                        </p>
                    </div>

                    <div className="mt-10 backdrop-blur-md bg-white/10 p-4 px-8 rounded-full border border-white/20 shadow-2xl">
                        <div className="flex items-center gap-4">
                            <CalendarIcon size={24} className="text-violet-200" />
                            <span className="text-lg font-medium tracking-wide">{formattedDate}</span>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="text-sm opacity-50 z-10 text-center mb-4">
                    &copy; {date.getFullYear()} District Administration
                </div>
            </motion.div>

            {/* Right Side - Login Form */}
            <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="md:w-1/2 p-8 md:p-16 flex flex-col justify-center relative"
            >
                {/* Theme Toggle */}
                <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="absolute top-8 right-8 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className="max-w-md mx-auto w-full">
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
                        {showForgot ? 'Reset Password' : 'Welcome Back'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg">
                        {showForgot ? 'Enter your email to receive a reset link.' : 'Please sign in to continue.'}
                    </p>

                    {!showForgot && (
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-8">
                            <button
                                onClick={() => setRole('admin')}
                                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all shadow-sm ${role === 'admin' ? 'bg-white dark:bg-indigo-700 text-indigo-700 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                            >
                                Admin View
                            </button>
                            <button
                                onClick={() => setRole('viewer')}
                                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all shadow-sm ${role === 'viewer' ? 'bg-white dark:bg-indigo-700 text-indigo-700 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                            >
                                Agency View
                            </button>
                        </div>
                    )}

                    {showForgot ? (
                        <form onSubmit={handleForgot} className="space-y-6">
                            <div>
                                <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">Email Address</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-4 h-6 w-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-dark-card dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                        placeholder="admin@example.com"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-700 hover:bg-indigo-800 text-white text-lg font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForgot(false)}
                                className="w-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium pt-2"
                            >
                                Back to Login
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">Username / Agency</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-4 h-6 w-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-dark-card dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                        placeholder="Enter your name"
                                    />
                                </div>
                            </div>

                            {role === 'admin' && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                    <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-4 h-6 w-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 border-slate-200 dark:border-slate-700 dark:bg-dark-card dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="flex justify-between items-center mt-2 px-1">
                                        <button type="button" onClick={fetchHint} className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">
                                            Need a hint?
                                        </button>
                                        <button type="button" onClick={() => setShowForgot(true)} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
                                            Forgot Password?
                                        </button>
                                    </div>
                                    {hint && <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium bg-amber-50 dark:bg-amber-900/20 p-2 rounded">Hint: {hint}</div>}
                                </motion.div>
                            )}

                            {error && <div className="text-red-500 text-center font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</div>}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-700 hover:bg-indigo-800 text-white text-lg font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
                            >
                                {loading ? 'Checking...' : 'Sign In'}
                            </button>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
