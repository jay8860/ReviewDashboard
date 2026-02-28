import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, FileText, Download, Brain, MessageSquareText,
    RefreshCw, Copy, Check
} from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

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

const DocumentAnalysisWorkspace = ({ user, onLogout }) => {
    const { deptId, meetingId, docId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const deptIdInt = parseInt(deptId, 10);
    const meetingIdInt = meetingId ? parseInt(meetingId, 10) : null;
    const docIdInt = parseInt(docId, 10);
    const isMeetingScope = Number.isFinite(meetingIdInt);

    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [dept, setDept] = useState(null);
    const [doc, setDoc] = useState(null);
    const [copied, setCopied] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const deptData = await api.getDepartment(deptIdInt);
            const docData = isMeetingScope
                ? await api.getMeetingDocument(deptIdInt, meetingIdInt, docIdInt)
                : await api.getDepartmentDocument(deptIdInt, docIdInt);
            setDept(deptData);
            setDoc(docData);
        } catch {
            toast.error('Failed to load analysis workspace');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [deptId, meetingId, docId]);

    const downloadDoc = async () => {
        if (!doc) return;
        try {
            const response = isMeetingScope
                ? await api.downloadMeetingDocument(deptIdInt, meetingIdInt, doc.id)
                : await api.downloadDepartmentDocument(deptIdInt, doc.id);
            const disposition = response.headers['content-disposition'];
            const filename = fileNameFromDisposition(disposition) || doc.original_filename || 'document';
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

    const runAnalysis = async (mode) => {
        if (!doc) return;
        let payload = { mode: 'default' };
        if (mode === 'custom') {
            const prompt = window.prompt('Enter custom instruction for this document analysis:');
            if (!prompt || !prompt.trim()) return;
            payload = { mode: 'custom', prompt: prompt.trim() };
        }

        setAnalyzing(true);
        try {
            const updated = isMeetingScope
                ? await api.analyzeMeetingDocument(deptIdInt, meetingIdInt, doc.id, payload)
                : await api.analyzeDepartmentDocument(deptIdInt, doc.id, payload);
            setDoc(updated);
            toast.success(mode === 'custom' ? 'Custom analysis completed' : 'Default analysis completed');
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Analysis failed';
            toast.error(msg);
        } finally {
            setAnalyzing(false);
        }
    };

    const copyAnalysis = async () => {
        if (!doc?.analysis_output) return;
        try {
            await navigator.clipboard.writeText(doc.analysis_output);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('Failed to copy analysis');
        }
    };

    const backPath = isMeetingScope
        ? `/departments/${deptIdInt}/meetings/${meetingIdInt}`
        : `/departments/${deptIdInt}`;

    if (loading) {
        return (
            <Layout user={user} onLogout={onLogout}>
                <div className="flex items-center justify-center h-64">
                    <RefreshCw size={32} className="animate-spin text-violet-500" />
                </div>
            </Layout>
        );
    }

    if (!dept || !doc) {
        return (
            <Layout user={user} onLogout={onLogout}>
                <div className="glass-card rounded-3xl p-10 text-center">
                    <p className="text-lg font-black text-slate-800">Analysis workspace not found</p>
                    <button
                        onClick={() => navigate(backPath)}
                        className="mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700"
                    >
                        Back
                    </button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="space-y-6">
                <div className="glass-card rounded-3xl overflow-hidden border border-violet-100/70 dark:border-violet-500/20">
                    <div className="px-6 py-5 bg-gradient-to-r from-violet-50 via-indigo-50 to-white border-b border-violet-100/70">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate(backPath)}
                                    className="p-2.5 rounded-xl hover:bg-white/80 text-slate-500"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <div>
                                    <h1 className="text-2xl font-black text-slate-900">Document Analysis Workspace</h1>
                                    <p className="text-sm text-slate-500">{dept.name} · {doc.original_filename}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={downloadDoc} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 inline-flex items-center gap-1.5">
                                    <Download size={14} /> Download
                                </button>
                                <button onClick={() => runAnalysis('default')} disabled={analyzing} className="px-3 py-2 rounded-xl bg-indigo-100 text-indigo-700 text-sm font-bold hover:bg-indigo-200 inline-flex items-center gap-1.5 disabled:opacity-60">
                                    <Brain size={14} /> Re-run Default
                                </button>
                                <button onClick={() => runAnalysis('custom')} disabled={analyzing} className="px-3 py-2 rounded-xl bg-violet-100 text-violet-700 text-sm font-bold hover:bg-violet-200 inline-flex items-center gap-1.5 disabled:opacity-60">
                                    <MessageSquareText size={14} /> Re-run Custom
                                </button>
                                <button onClick={copyAnalysis} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 inline-flex items-center gap-1.5">
                                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-b border-violet-100/70 bg-white/90">
                        <div className="flex items-center gap-4 flex-wrap text-xs font-semibold text-slate-500">
                            <span className="inline-flex items-center gap-1"><FileText size={12} /> {formatSize(doc.file_size)}</span>
                            <span>Status: {doc.analysis_status || 'Not Analyzed'}</span>
                            <span>Mode: {doc.analysis_mode || '—'}</span>
                            {doc.extraction_truncated ? <span className="text-amber-600">Text extraction truncated</span> : null}
                        </div>
                        {doc.analysis_prompt ? (
                            <p className="mt-2 text-xs text-violet-700"><span className="font-black">Custom prompt:</span> {doc.analysis_prompt}</p>
                        ) : null}
                    </div>

                    <div className="p-6 bg-white/95">
                        {analyzing ? (
                            <div className="flex items-center gap-2 text-sm text-violet-600 font-semibold">
                                <RefreshCw size={16} className="animate-spin" /> Regenerating analysis...
                            </div>
                        ) : doc.analysis_output ? (
                            <div className="rounded-2xl border border-violet-100 bg-violet-50/35 p-5 max-h-[72vh] overflow-auto custom-scrollbar">
                                <pre className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                                    {doc.analysis_output}
                                </pre>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-violet-100 bg-violet-50/35 p-5">
                                <p className="text-sm text-slate-500 italic">No analysis available yet. Use Re-run Default or Re-run Custom.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default DocumentAnalysisWorkspace;
