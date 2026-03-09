import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const sortEmployees = (rows = []) => (
    [...rows].sort((a, b) => {
        const aName = normalizeText(a?.name);
        const bName = normalizeText(b?.name);
        if (aName && bName && aName !== bName) return aName.localeCompare(bName);
        return normalizeText(a?.display_username).localeCompare(normalizeText(b?.display_username));
    })
);

const employeeSearchBlob = (employee) => normalizeText(
    `${employee?.name || ''} ${employee?.display_username || ''} ${employee?.department_name || ''}`
);
const baseInputClass = 'px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300';

export const getEmployeeAssignmentLabel = (employee) => {
    if (!employee) return '';
    const name = String(employee.name || '').trim();
    const designation = String(employee.display_username || '').trim();
    if (name && designation) return `${name} (${designation})`;
    return name || designation || `Employee ${employee.id}`;
};

const EmployeeSearchSelect = ({
    employees = [],
    value = '',
    onChange,
    placeholder = 'Search by name or designation',
    noneLabel = 'No employee',
    disabled = false,
    className = '',
    inputClassName = '',
    menuClassName = '',
}) => {
    const containerRef = useRef(null);
    const sortedEmployees = useMemo(() => sortEmployees(employees), [employees]);
    const selectedEmployee = useMemo(
        () => sortedEmployees.find((emp) => String(emp.id) === String(value || '')) || null,
        [sortedEmployees, value]
    );
    const selectedLabel = selectedEmployee ? getEmployeeAssignmentLabel(selectedEmployee) : '';

    const [query, setQuery] = useState(selectedLabel);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            setQuery(selectedLabel);
        }
    }, [open, selectedLabel]);

    useEffect(() => {
        const onDocPointerDown = (event) => {
            if (!containerRef.current || containerRef.current.contains(event.target)) return;
            setOpen(false);
            setQuery(selectedLabel);
        };
        document.addEventListener('mousedown', onDocPointerDown);
        return () => document.removeEventListener('mousedown', onDocPointerDown);
    }, [selectedLabel]);

    const filteredEmployees = useMemo(() => {
        const q = normalizeText(query);
        if (!q) return sortedEmployees;
        return sortedEmployees.filter((emp) => employeeSearchBlob(emp).includes(q));
    }, [query, sortedEmployees]);

    const pickEmployee = (employee) => {
        const nextValue = employee ? String(employee.id) : '';
        if (onChange) onChange(nextValue);
        setQuery(employee ? getEmployeeAssignmentLabel(employee) : '');
        setOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                    type="text"
                    value={query}
                    disabled={disabled}
                    onFocus={() => !disabled && setOpen(true)}
                    onChange={(e) => {
                        const text = e.target.value;
                        setQuery(text);
                        if (!open && !disabled) setOpen(true);
                        if (!text.trim() && onChange) onChange('');
                    }}
                    placeholder={placeholder}
                    className={`${baseInputClass} ${inputClassName} w-full pl-8 pr-8`}
                />
                {!disabled && query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            if (onChange) onChange('');
                            setOpen(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Clear selection"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            {open && !disabled && (
                <div className={`absolute z-[80] mt-1 w-full max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl ${menuClassName}`}>
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            pickEmployee(null);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 border-b border-slate-100"
                    >
                        {noneLabel}
                    </button>

                    {filteredEmployees.map((emp) => {
                        const name = String(emp.name || '').trim() || `Employee ${emp.id}`;
                        const designation = String(emp.display_username || '').trim();
                        return (
                            <button
                                key={emp.id}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    pickEmployee(emp);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-slate-50 last:border-b-0"
                            >
                                <p className="text-xs font-semibold text-slate-700">{name}</p>
                                {designation ? <p className="text-[11px] text-slate-500">{designation}</p> : null}
                            </button>
                        );
                    })}

                    {!filteredEmployees.length && (
                        <p className="px-3 py-2 text-xs text-slate-400 italic">No employee matches this search.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default EmployeeSearchSelect;
