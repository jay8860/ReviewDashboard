import React from 'react';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon: Icon, color, delay, onClick }) => {
    const colors = {
        indigo: 'text-indigo-600 dark:text-indigo-400',
        green: 'text-emerald-600 dark:text-emerald-400',
        yellow: 'text-amber-600 dark:text-amber-400',
        red: 'text-rose-600 dark:text-rose-400',
    };

    const lightGradients = {
        indigo: 'from-indigo-500/20 to-indigo-500/5',
        green: 'from-emerald-500/20 to-emerald-500/5',
        yellow: 'from-amber-500/20 to-amber-500/5',
        red: 'from-rose-500/20 to-rose-500/5',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            whileHover={{ y: -6, scale: 1.02 }}
            onClick={onClick}
            className={`glass-card p-6 rounded-[2rem] border relative overflow-hidden group transition-premium ${onClick ? 'cursor-pointer' : ''}`}
        >
            {/* Subtle Gradient Glow */}
            <div className={`absolute -right-6 -top-6 w-32 h-32 blur-3xl opacity-20 pointer-events-none bg-gradient-to-br ${lightGradients[color]}`}></div>

            <div className="flex justify-between items-center relative z-10">
                <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500/80 dark:text-white/40 mb-1">{title}</p>
                    <h3 className="text-4xl font-black tracking-tight dark:text-white">{value}</h3>
                </div>
                <div className={`p-4 rounded-2xl shadow-inner transition-transform group-hover:rotate-12 duration-500 ${colors[color]} bg-slate-50 dark:bg-white/5`}>
                    <Icon size={28} className="drop-shadow-sm" />
                </div>
            </div>

            {/* Animated Progress Bar Placeholder (Visual Only) */}
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-white/5">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ delay: 0.5 + delay * 0.1, duration: 1.5, ease: "circOut" }}
                    className={`h-full opacity-30 shadow-[0_0_8px_rgba(0,0,0,0.1)] bg-gradient-to-r ${color === 'indigo' ? 'from-indigo-500' : color === 'green' ? 'from-emerald-500' : color === 'yellow' ? 'from-amber-500' : 'from-rose-500'} to-transparent`}
                />
            </div>
        </motion.div>
    );
};

export default StatCard;
