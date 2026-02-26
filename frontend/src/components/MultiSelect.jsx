import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

const MultiSelect = ({ label, options, selected, onChange, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option];
        onChange(newSelected);
    };

    const clearSelection = (e) => {
        e.stopPropagation();
        onChange([]);
    };

    return (
        <div className="relative" ref={containerRef}>
            {/* Trigger Button */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-transparent hover:border-indigo-300 dark:hover:border-slate-600 rounded-lg cursor-pointer transition-colors min-w-[180px]"
            >
                <div className="flex flex-col items-start truncate max-w-[200px]">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate w-full text-left">
                        {selected.length === 0
                            ? placeholder
                            : selected.length === 1
                                ? selected[0]
                                : `${selected.length} Selected`}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    {selected.length > 0 && (
                        <div onClick={clearSelection} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-red-500">
                            <X size={14} />
                        </div>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-64 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                        {options.map((option) => {
                            const isSelected = selected.includes(option);
                            return (
                                <div
                                    key={option}
                                    onClick={() => toggleOption(option)}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected
                                            ? 'bg-indigo-600 border-indigo-600'
                                            : 'border-slate-300 dark:border-slate-600'
                                        }`}>
                                        {isSelected && <Check size={12} className="text-white" />}
                                    </div>
                                    <span className="text-sm">{option}</span>
                                </div>
                            );
                        })}

                        {options.length === 0 && (
                            <div className="px-4 py-3 text-sm text-center text-slate-400">
                                No options available
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
