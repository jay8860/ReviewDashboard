import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, FileText, Download, Brain, MessageSquareText,
    RefreshCw, Copy, Check, GitCompareArrows, History
} from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import MarkdownAnalysis from '../components/MarkdownAnalysis';
import TaskSuggestionsEditor from '../components/TaskSuggestionsEditor';
import BulletTaskPad from '../components/BulletTaskPad';

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

const isMeetingDocument = (item) => item?.meeting_id !== null && item?.meeting_id !== undefined;

const sortDocsByNewest = (items = []) =>
    [...items].sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());

const formatDateTime = (value) => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
};

const DocumentAnalysisWorkspace = ({ user, onLogout }) => {
    const { deptId, meetingId, docId } = useParams();
    const location = useLocation();
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
    const [historyDocs, setHistoryDocs] = useState([]);
    const [leftCompareId, setLeftCompareId] = useState('');
    const [rightCompareId, setRightCompareId] = useState('');
    const [comparing, setComparing] = useState(false);
    const [comparisonResult, setComparisonResult] = useState(null);

    useEffect(() => {
        const snapshot = location.state?.docSnapshot;
        if (snapshot && snapshot.id === docIdInt) {
            setDoc(snapshot);
            setLoading(false);
        }
    }, [location.state, docIdInt]);

    const fetchHistoryDocs = async () => {
        if (isMeetingScope) {
            const [meetingDocs, departmentDocs] = await Promise.all([
                api.getMeetingDocuments(deptIdInt, meetingIdInt),
                api.getDepartmentDocuments(deptIdInt),
            ]);
            return sortDocsByNewest([...(meetingDocs || []), ...(departmentDocs || [])]);
        }
        const departmentDocs = await api.getDepartmentDocuments(deptIdInt);
        return sortDocsByNewest(departmentDocs || []);
    };

    const load = async () => {
        setLoading(true);
        try {
            const [deptData, docData, history] = await Promise.all([
                api.getDepartment(deptIdInt),
                isMeetingScope
                    ? api.getMeetingDocument(deptIdInt, meetingIdInt, docIdInt)
                    : api.getDepartmentDocument(deptIdInt, docIdInt),
                fetchHistoryDocs(),
            ]);
            setDept(deptData);
            setDoc(docData);
            setHistoryDocs(history);
        } catch {
            toast.error('Failed to load analysis workspace');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [deptId, meetingId, docId]);

    const comparableDocs = useMemo(
        () => historyDocs.filter((item) => (item.analysis_output || '').trim().length > 0),
        [historyDocs]
    );

    useEffect(() => {
        if (comparableDocs.length < 2) {
            setLeftCompareId('');
            setRightCompareId('');
            return;
        }
        if (!leftCompareId || !comparableDocs.find((item) => String(item.id) === String(leftCompareId))) {
            setLeftCompareId(String(comparableDocs[1]?.id || comparableDocs[0].id));
        }
        if (!rightCompareId || !comparableDocs.find((item) => String(item.id) === String(rightCompareId))) {
            setRightCompareId(String(comparableDocs[0].id));
        }
    }, [comparableDocs, leftCompareId, rightCompareId]);

    const downloadDoc = async () => {
        if (!doc) return;
        try {
            const response = isMeetingDocument(doc)
                ? await api.downloadMeetingDocument(deptIdInt, Number(doc.meeting_id), doc.id)
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
            const updated = isMeetingDocument(doc)
                ? await api.analyzeMeetingDocument(deptIdInt, Number(doc.meeting_id), doc.id, payload)
                : await api.analyzeDepartmentDocument(deptIdInt, doc.id, payload);
            setDoc(updated);
            try {
                setHistoryDocs(await fetchHistoryDocs());
            } catch {
                // Keep latest analysis visible even if history refresh fails.
            }
            setComparisonResult(null);
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

    const generateTaskSuggestions = async () => {
        if (!doc) return { suggestions: [] };
        if (isMeetingDocument(doc)) {
            return api.suggestTasksFromMeetingDocument(deptIdInt, Number(doc.meeting_id), doc.id, {});
        }
        return api.suggestTasksFromDepartmentDocument(deptIdInt, doc.id, {});
    };

    const confirmTaskSuggestions = async (suggestions) => {
        return api.confirmTaskSuggestions(deptIdInt, { suggestions });
    };

    const backPath = isMeetingScope
        ? `/departments/${deptIdInt}/meetings/${meetingIdInt}`
        : `/departments/${deptIdInt}`;

    const openHistoryDoc = (historyDoc) => {
        if (!historyDoc) return;
        const path = isMeetingDocument(historyDoc)
            ? `/departments/${deptIdInt}/meetings/${Number(historyDoc.meeting_id)}/documents/${historyDoc.id}/analysis`
            : `/departments/${deptIdInt}/documents/${historyDoc.id}/analysis`;
        navigate(path, { state: { docSnapshot: historyDoc } });
    };

    const runComparison = async () => {
        const leftId = Number(leftCompareId);
        const rightId = Number(rightCompareId);
        if (!Number.isFinite(leftId) || !Number.isFinite(rightId)) {
            toast.error('Choose two analysis versions');
            return;
        }
        if (leftId === rightId) {
            toast.error('Choose two different dates/versions');
            return;
        }
        setComparing(true);
        try {
            const result = await api.compareDepartmentDocumentAnalyses(deptIdInt, {
                left_doc_id: leftId,
                right_doc_id: rightId,
            });
            setComparisonResult(result);
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Failed to compare analysis outputs';
            toast.error(msg);
        } finally {
            setComparing(false);
        }
    };

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
                                <MarkdownAnalysis content={doc.analysis_output} />
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-violet-100 bg-violet-50/35 p-5">
                                <p className="text-sm text-slate-500 italic">No analysis available yet. Use Re-run Default or Re-run Custom.</p>
                            </div>
                        )}
                    </div>
                </div>

                <TaskSuggestionsEditor
                    title="Task Suggestions From This Analysis"
                    subtitle="Generate actionable tasks from this document analysis, edit as needed, then confirm creation."
                    generateLabel="Suggest Tasks"
                    onGenerate={generateTaskSuggestions}
                    onConfirmCreate={confirmTaskSuggestions}
                />

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="glass-card rounded-3xl overflow-hidden border border-violet-100/70">
                        <div className="px-5 py-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <History size={16} className="text-violet-600" /> Analysis History (Date-wise)
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Click any dated version to open that analysis in this workspace.
                            </p>
                        </div>
                        <div className="p-4 bg-white/95">
                            {historyDocs.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No document versions available.</p>
                            ) : (
                                <div className="max-h-[360px] overflow-auto custom-scrollbar space-y-2">
                                    {historyDocs.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => openHistoryDoc(item)}
                                            className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                                                item.id === doc.id
                                                    ? 'border-violet-300 bg-violet-50'
                                                    : 'border-violet-100 bg-white hover:bg-violet-50/50'
                                            }`}
                                        >
                                            <p className="text-xs font-black text-slate-800 break-all">{item.original_filename}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                {formatDateTime(item.created_at)} · {item.analysis_status || 'Not analyzed'} · {isMeetingDocument(item) ? 'Meeting' : 'Department'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="glass-card rounded-3xl overflow-hidden border border-violet-100/70">
                        <div className="px-5 py-4 border-b border-violet-100 bg-gradient-to-r from-indigo-50 to-white">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <GitCompareArrows size={16} className="text-indigo-600" /> Compare Two Dates / Versions
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Pick any two analysis outputs to evaluate progress in comparable parameters.
                            </p>
                        </div>
                        <div className="p-4 bg-white/95 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <select
                                    value={leftCompareId}
                                    onChange={(e) => setLeftCompareId(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-violet-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                >
                                    <option value="">Select Version A</option>
                                    {comparableDocs.map((item) => (
                                        <option key={`left-${item.id}`} value={String(item.id)}>
                                            {formatDateTime(item.created_at)} - {item.original_filename}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={rightCompareId}
                                    onChange={(e) => setRightCompareId(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-violet-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
                                >
                                    <option value="">Select Version B</option>
                                    {comparableDocs.map((item) => (
                                        <option key={`right-${item.id}`} value={String(item.id)}>
                                            {formatDateTime(item.created_at)} - {item.original_filename}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={runComparison}
                                disabled={comparing || comparableDocs.length < 2}
                                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-1.5"
                            >
                                {comparing ? <RefreshCw size={13} className="animate-spin" /> : <GitCompareArrows size={13} />}
                                {comparing ? 'Comparing…' : 'Compare Versions'}
                            </button>

                            {comparisonResult?.comparison_output ? (
                                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/35 p-4 max-h-[440px] overflow-auto custom-scrollbar">
                                    {comparisonResult.compare_engine === 'fallback' ? (
                                        <p className="text-[11px] font-semibold text-amber-700 mb-2">
                                            AI compare was unavailable, so fallback comparison is shown.
                                        </p>
                                    ) : null}
                                    <MarkdownAnalysis content={comparisonResult.comparison_output} compact />
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">
                                    Select two versions and click compare.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <BulletTaskPad
                    title="Document Workspace Task Notepad"
                    subtitle="Type bullet points from this review and convert selected items directly into tasks."
                    storageKey={`document-bullet-notes-${deptIdInt}-${meetingIdInt || 'department'}-${docIdInt}`}
                    onConfirmCreate={confirmTaskSuggestions}
                />
            </div>
        </Layout>
    );
};

export default DocumentAnalysisWorkspace;
