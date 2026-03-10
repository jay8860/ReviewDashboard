import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
    info: Info,
};

const COLORS = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300',
    error: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300',
    info: 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-300',
};

const ICON_COLORS = {
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    error: 'text-rose-500',
    info: 'text-indigo-500',
};

let toastId = 0;

const stringifyToastMessage = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Error) return value.message || 'Unexpected error';
    if (Array.isArray(value)) {
        const parts = value.map((item) => stringifyToastMessage(item)).filter(Boolean);
        return parts.join(' | ');
    }
    if (typeof value === 'object') {
        if (typeof value.detail === 'string') return value.detail;
        if (Array.isArray(value.detail)) return stringifyToastMessage(value.detail);
        if (typeof value.msg === 'string') {
            const loc = Array.isArray(value.loc) ? value.loc.filter(Boolean).join(' > ') : '';
            return loc ? `${value.msg} (${loc})` : value.msg;
        }
        try {
            return JSON.stringify(value);
        } catch {
            return 'Unexpected error';
        }
    }
    return String(value);
};

const normalizeToastMessage = (message, fallback = 'Something went wrong') => {
    const text = stringifyToastMessage(message).trim();
    if (!text) return fallback;
    return text.length > 300 ? `${text.slice(0, 297)}...` : text;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const toast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++toastId;
        setToasts(prev => [...prev, {
            id,
            message: normalizeToastMessage(message, type === 'error' ? 'Something went wrong' : 'Notification'),
            type,
            duration,
        }]);
        return id;
    }, []);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Convenience methods
    toast.success = (msg, dur) => toast(msg, 'success', dur);
    toast.error = (msg, dur) => toast(msg, 'error', dur || 5000);
    toast.warning = (msg, dur) => toast(msg, 'warning', dur);
    toast.info = (msg, dur) => toast(msg, 'info', dur);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 max-w-sm w-full pointer-events-none">
                <AnimatePresence mode="popLayout">
                    {toasts.map(t => (
                        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onDismiss }) => {
    const Icon = ICONS[toast.type] || Info;

    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-lg backdrop-blur-sm ${COLORS[toast.type]}`}
        >
            <Icon size={18} className={`shrink-0 mt-0.5 ${ICON_COLORS[toast.type]}`} />
            <p className="flex-1 text-sm font-semibold leading-snug">{toast.message}</p>
            <button
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 p-0.5 rounded-lg hover:bg-black/10 transition-colors opacity-60 hover:opacity-100"
            >
                <X size={14} />
            </button>
        </motion.div>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};
