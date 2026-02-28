import React, { useEffect, useMemo, useState } from 'react';
import {
    Upload, Brain, Sparkles, Trash2, Download,
    FileText, Loader2, MessageSquareText
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from './Toast';

const formatSize = (bytes = 0) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const fileNameFromDisposition = (header) => {
    if (!header) return null;
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const DocumentAnalysisPanel = ({ deptId, meetingId = null, title = 'Documents & AI Analysis' }) => {
    const toast = useToast();
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [analyzingDocId, setAnalyzingDocId] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    const isMeetingScope = useMemo(() => Number.isFinite(meetingId) && meetingId !== null, [meetingId]);

    const loadDocs = async () => {
        setLoading(true);
        try {
            const data = isMeetingScope
                ? await api.getMeetingDocuments(deptId, meetingId)
                : await api.getDepartmentDocuments(deptId);
            setDocs(data || []);
        } catch {
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!deptId) return;
        loadDocs();
    }, [deptId, meetingId]);

    const uploadAndAnalyzeDefault = async () => {
        if (!selectedFile) {
            toast.error('Please select a file first');
            return;
        }
        setUploading(true);
        try {
            const created = isMeetingScope
                ? await api.uploadMeetingDocument(deptId, meetingId, selectedFile)
                : await api.uploadDepartmentDocument(deptId, selectedFile);

            setDocs(prev => [created, ...prev]);
            setSelectedFile(null);

            // Default mode is automatically applied after upload.
            await runAnalysis(created.id, 'default');
            toast.success('Uploaded and analyzed (default mode)');
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Upload failed';
            toast.error(msg);
        } finally {
            setUploading(false);
        }
    };

    const runAnalysis = async (docId, mode, promptText = null) => {
        setAnalyzingDocId(docId);
        try {
            const payload = mode === 'custom'
                ? { mode: 'custom', prompt: promptText }
                : { mode: 'default' };

            const updated = isMeetingScope
                ? await api.analyzeMeetingDocument(deptId, meetingId, docId, payload)
                : await api.analyzeDepartmentDocument(deptId, docId, payload);

            setDocs(prev => prev.map(d => (d.id === docId ? updated : d)));
            return updated;
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Analysis failed';
            toast.error(msg);
            throw e;
        } finally {
            setAnalyzingDocId(null);
        }
    };

    const runCustomAnalysis = async (docId) => {
        const promptText = window.prompt('Enter custom instruction for this document analysis:');
        if (!promptText || !promptText.trim()) return;
        await runAnalysis(docId, 'custom', promptText.trim());
        toast.success('Custom analysis completed');
    };

    const deleteDoc = async (docId) => {
        if (!window.confirm('Delete this document?')) return;
        try {
            if (isMeetingScope) {
                await api.deleteMeetingDocument(deptId, meetingId, docId);
            } else {
                await api.deleteDepartmentDocument(deptId, docId);
            }
            setDocs(prev => prev.filter(d => d.id !== docId));
            toast.success('Document deleted');
        } catch {
            toast.error('Delete failed');
        }
    };

    const downloadDoc = async (docId) => {
        try {
            const response = isMeetingScope
                ? await api.downloadMeetingDocument(deptId, meetingId, docId)
                : await api.downloadDepartmentDocument(deptId, docId);

            const disposition = response.headers['content-disposition'];
            const fallbackName = docs.find(d => d.id === docId)?.original_filename || 'document';
            const filename = fileNameFromDisposition(disposition) || fallbackName;

            const blobUrl = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(blobUrl);
        } catch {
            toast.error('Download failed');
        }
    };

    return (
        <div className="glass-card rounded-3xl overflow-hidden border border-violet-100/70 dark:border-violet-500/20">
            <div className="px-5 py-4 border-b border-violet-100/70 dark:border-violet-500/20 bg-gradient-to-r from-violet-50 via-indigo-50 to-white dark:from-violet-500/10 dark:via-indigo-500/10 dark:to-transparent">
                <div className="flex items-center gap-2">
                    <FileText size={18} className="text-violet-600" />
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    Default mode gives agenda-wise findings automatically. Custom mode asks your prompt.
                </p>
            </div>

            <div className="p-5 bg-white/95 dark:bg-white/5 border-b border-violet-100/70 dark:border-violet-500/20">
                <div className="flex items-center gap-2 flex-wrap">
                    <label className="px-3 py-2 rounded-xl border border-violet-200 text-violet-700 text-xs font-bold cursor-pointer hover:bg-violet-50 transition-colors">
                        <input
                            type="file"
                            className="hidden"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            accept=".txt,.md,.csv,.json,.docx,.pptx,.pdf,.xlsx"
                        />
                        <span className="inline-flex items-center gap-1"><Upload size={12} /> Choose File</span>
                    </label>
                    {selectedFile && (
                        <span className="text-xs text-slate-500 font-semibold truncate max-w-[300px]">{selectedFile.name}</span>
                    )}
                    <button
                        onClick={uploadAndAnalyzeDefault}
                        disabled={uploading}
                        className="ml-auto px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-black hover:bg-violet-700 transition-colors disabled:opacity-60 inline-flex items-center gap-1"
                    >
                        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        {uploading ? 'Uploading…' : 'Upload + Default Analyze'}
                    </button>
                </div>
            </div>

            <div className="p-5 space-y-4 max-h-[560px] overflow-auto custom-scrollbar bg-white/95 dark:bg-white/5">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-violet-600 font-semibold">
                        <Loader2 size={16} className="animate-spin" /> Loading documents...
                    </div>
                ) : docs.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No documents uploaded yet.</p>
                ) : (
                    docs.map(doc => (
                        <div key={doc.id} className="rounded-2xl border border-violet-100 dark:border-violet-500/20 overflow-hidden bg-white dark:bg-white/5">
                            <div className="px-4 py-3 border-b border-violet-100 dark:border-violet-500/20 bg-violet-50/70 dark:bg-violet-500/10">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-800 dark:text-white break-all">{doc.original_filename}</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {formatSize(doc.file_size)} · {doc.analysis_status || 'Not Analyzed'}
                                            {doc.extraction_truncated ? ' · text truncated' : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                        <button
                                            onClick={() => runAnalysis(doc.id, 'default')}
                                            disabled={analyzingDocId === doc.id}
                                            className="px-2.5 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-[11px] font-bold hover:bg-indigo-200 transition-colors disabled:opacity-60 inline-flex items-center gap-1"
                                        >
                                            <Brain size={12} /> Default
                                        </button>
                                        <button
                                            onClick={() => runCustomAnalysis(doc.id)}
                                            disabled={analyzingDocId === doc.id}
                                            className="px-2.5 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-[11px] font-bold hover:bg-violet-200 transition-colors disabled:opacity-60 inline-flex items-center gap-1"
                                        >
                                            <MessageSquareText size={12} /> Custom
                                        </button>
                                        <button
                                            onClick={() => downloadDoc(doc.id)}
                                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200 transition-colors inline-flex items-center gap-1"
                                        >
                                            <Download size={12} /> Download
                                        </button>
                                        <button
                                            onClick={() => deleteDoc(doc.id)}
                                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[11px] font-bold hover:bg-rose-100 transition-colors inline-flex items-center gap-1"
                                        >
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="px-4 py-3">
                                {analyzingDocId === doc.id ? (
                                    <div className="flex items-center gap-2 text-sm text-violet-600 font-semibold">
                                        <Loader2 size={15} className="animate-spin" /> Running AI analysis...
                                    </div>
                                ) : doc.analysis_output ? (
                                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-indigo-500 mb-2">
                                            Analysis ({doc.analysis_mode || 'default'})
                                        </p>
                                        {doc.analysis_prompt && (
                                            <p className="text-[11px] text-violet-600 mb-2"><span className="font-black">Prompt:</span> {doc.analysis_prompt}</p>
                                        )}
                                        <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-auto custom-scrollbar">
                                            {doc.analysis_output}
                                        </div>
                                    </div>
                                ) : doc.analysis_error ? (
                                    <p className="text-xs text-rose-600">{doc.analysis_error}</p>
                                ) : (
                                    <p className="text-xs text-slate-400">No analysis yet. Use Default or Custom analyze.</p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DocumentAnalysisPanel;
