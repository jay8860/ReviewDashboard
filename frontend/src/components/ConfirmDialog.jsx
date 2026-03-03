import React from 'react';

const ConfirmDialog = ({
    open,
    title = 'Confirm action',
    message = 'Are you sure?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onCancel,
    onConfirm,
}) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[120] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
                    <h3 className="text-lg font-black text-slate-800">{title}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{message}</p>
                </div>
                <div className="px-6 py-4 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-xl text-white font-bold ${
                            destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
