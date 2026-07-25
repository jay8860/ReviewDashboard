import React, { useEffect, useMemo, useState } from 'react';
import {
    Brain, ExternalLink, FileStack, FileText, Loader2, MapPinned, Plus,
    Save, Sparkles, Trash2, Upload, Download, Eye, Link as LinkIcon
} from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

const emptyMetric = () => ({ label: '', value: '', note: '' });
const emptySection = () => ({ title: '', body: '' });

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

const formatDateTime = (value) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
};

const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm';
const labelCls = 'block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5';

const GeneralInfo = ({ user, onLogout }) => {
    const toast = useToast();
    const [profile, setProfile] = useState({
        district_name: '',
        headline: '',
        overview_markdown: '',
        sections: [],
        key_metrics: [],
        raw_notes: '',
    });
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadMeta, setUploadMeta] = useState({ title: '', category: 'reference', is_map: false });
    const [linkForm, setLinkForm] = useState({ title: '', external_url: '', category: 'reference', is_map: false });
    const [selectedDocId, setSelectedDocId] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewMode, setPreviewMode] = useState('');

    const selectedDoc = useMemo(
        () => documents.find((doc) => doc.id === selectedDocId) || null,
        [documents, selectedDocId]
    );

    const load = async () => {
        setLoading(true);
        try {
            const payload = await api.getGeneralInfo();
            setProfile(payload?.profile || {
                district_name: '',
                headline: '',
                overview_markdown: '',
                sections: [],
                key_metrics: [],
                raw_notes: '',
            });
            setDocuments(payload?.documents || []);
            if (payload?.documents?.length) {
                setSelectedDocId(payload.documents[0].id);
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to load General Info');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        let revokeUrl = '';
        const loadPreview = async () => {
            if (!selectedDoc) {
                setPreviewUrl('');
                setPreviewMode('');
                return;
            }
            if (selectedDoc.external_url) {
                setPreviewUrl(selectedDoc.external_url);
                setPreviewMode(selectedDoc.is_map ? 'map' : 'link');
                return;
            }
            try {
                const response = await api.downloadGeneralInfoDocument(selectedDoc.id);
                const blobUrl = URL.createObjectURL(response.data);
                revokeUrl = blobUrl;
                setPreviewUrl(blobUrl);
                setPreviewMode(selectedDoc.mime_type?.includes('pdf') ? 'pdf' : 'file');
            } catch {
                setPreviewUrl('');
                setPreviewMode('');
            }
        };
        loadPreview();
        return () => {
            if (revokeUrl) URL.revokeObjectURL(revokeUrl);
        };
    }, [selectedDocId, documents]);

    const saveProfile = async () => {
        setSaving(true);
        try {
            const updated = await api.updateGeneralInfoProfile(profile);
            setProfile(updated);
            toast.success('General info saved');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const generateBrief = async () => {
        setGenerating(true);
        try {
            const result = await api.generateGeneralInfoBrief({});
            if (result?.profile) setProfile(result.profile);
            toast.success(result?.parsed ? 'AI brief generated' : 'AI draft added to overview');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'AI generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const uploadDocs = async () => {
        if (!selectedFiles.length) {
            toast.error('Select at least one file');
            return;
        }
        setUploading(true);
        try {
            const payload = await api.uploadGeneralInfoDocuments(selectedFiles, uploadMeta);
            const created = Array.isArray(payload) ? payload : [payload];
            setDocuments((prev) => [...created, ...prev]);
            if (created[0]) setSelectedDocId(created[0].id);
            setSelectedFiles([]);
            setUploadMeta({ title: '', category: 'reference', is_map: false });
            toast.success(`${created.length} reference file${created.length > 1 ? 's' : ''} uploaded`);
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const addLink = async () => {
        if (!linkForm.title.trim() || !linkForm.external_url.trim()) {
            toast.error('Enter link title and URL');
            return;
        }
        try {
            const created = await api.createGeneralInfoLink(linkForm);
            setDocuments((prev) => [created, ...prev]);
            setSelectedDocId(created.id);
            setLinkForm({ title: '', external_url: '', category: 'reference', is_map: false });
            toast.success('Reference link added');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to add link');
        }
    };

    const analyzeDoc = async (doc) => {
        try {
            const updated = await api.analyzeGeneralInfoDocument(doc.id, { mode: 'default' });
            setDocuments((prev) => prev.map((item) => item.id === doc.id ? updated : item));
            toast.success('Analysis completed');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Analysis failed');
        }
    };

    const deleteDoc = async (doc) => {
        if (!window.confirm('Delete this reference?')) return;
        try {
            await api.deleteGeneralInfoDocument(doc.id);
            setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
            if (selectedDocId === doc.id) setSelectedDocId(null);
            toast.success('Reference deleted');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Delete failed');
        }
    };

    const downloadDoc = async (doc) => {
        if (doc.external_url) {
            window.open(doc.external_url, '_blank', 'noopener,noreferrer');
            return;
        }
        try {
            const response = await api.downloadGeneralInfoDocument(doc.id);
            const blobUrl = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = doc.original_filename || doc.title || 'reference';
            link.click();
            URL.revokeObjectURL(blobUrl);
        } catch {
            toast.error('Download failed');
        }
    };

    const updateMetric = (index, key, value) => {
        setProfile((prev) => ({
            ...prev,
            key_metrics: prev.key_metrics.map((item, idx) => idx === index ? { ...item, [key]: value } : item),
        }));
    };

    const updateSection = (index, key, value) => {
        setProfile((prev) => ({
            ...prev,
            sections: prev.sections.map((item, idx) => idx === index ? { ...item, [key]: value } : item),
        }));
    };

    return (
        <Layout user={user} onLogout={onLogout}>
            <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tight">General Info</h1>
                    <p className="text-slate-500 mt-1 text-base">District brief, key metrics, maps, and reference documents.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={generateBrief}
                        disabled={generating}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-60"
                    >
                        {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        Generate Brief
                    </button>
                    <button
                        onClick={saveProfile}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="glass-card rounded-3xl p-8 text-slate-500 font-semibold">Loading General Info...</div>
            ) : (
                <div className="grid lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="glass-card rounded-3xl p-6 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>District Name</label>
                                    <input className={inputCls} value={profile.district_name || ''} onChange={(e) => setProfile((prev) => ({ ...prev, district_name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className={labelCls}>Headline</label>
                                    <input className={inputCls} value={profile.headline || ''} onChange={(e) => setProfile((prev) => ({ ...prev, headline: e.target.value }))} placeholder="Short one-line district positioning" />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Overview Brief</label>
                                <textarea className={`${inputCls} min-h-[180px]`} value={profile.overview_markdown || ''} onChange={(e) => setProfile((prev) => ({ ...prev, overview_markdown: e.target.value }))} placeholder="Structured narrative about population, geography, services, administration, priorities..." />
                            </div>
                            <div>
                                <label className={labelCls}>Raw Notes / New Information</label>
                                <textarea className={`${inputCls} min-h-[140px]`} value={profile.raw_notes || ''} onChange={(e) => setProfile((prev) => ({ ...prev, raw_notes: e.target.value }))} placeholder="Paste new district notes here. AI brief generation will use this along with analyzed documents." />
                            </div>
                        </div>

                        <div className="glass-card rounded-3xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-black dark:text-white">Key Metrics</h2>
                                <button onClick={() => setProfile((prev) => ({ ...prev, key_metrics: [...(prev.key_metrics || []), emptyMetric()] }))} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                                    <Plus size={14} /> Add Metric
                                </button>
                            </div>
                            <div className="space-y-3">
                                {(profile.key_metrics || []).map((metric, index) => (
                                    <div key={index} className="grid md:grid-cols-12 gap-3">
                                        <input className={`${inputCls} md:col-span-3`} value={metric.label || ''} onChange={(e) => updateMetric(index, 'label', e.target.value)} placeholder="Label" />
                                        <input className={`${inputCls} md:col-span-3`} value={metric.value || ''} onChange={(e) => updateMetric(index, 'value', e.target.value)} placeholder="Value" />
                                        <input className={`${inputCls} md:col-span-5`} value={metric.note || ''} onChange={(e) => updateMetric(index, 'note', e.target.value)} placeholder="Note / context" />
                                        <button onClick={() => setProfile((prev) => ({ ...prev, key_metrics: prev.key_metrics.filter((_, idx) => idx !== index) }))} className="md:col-span-1 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {!(profile.key_metrics || []).length && <p className="text-sm text-slate-400">No metrics added yet.</p>}
                            </div>
                        </div>

                        <div className="glass-card rounded-3xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-black dark:text-white">Structured Sections</h2>
                                <button onClick={() => setProfile((prev) => ({ ...prev, sections: [...(prev.sections || []), emptySection()] }))} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                                    <Plus size={14} /> Add Section
                                </button>
                            </div>
                            <div className="space-y-4">
                                {(profile.sections || []).map((section, index) => (
                                    <div key={index} className="rounded-2xl border border-slate-200 bg-white/70 p-4 space-y-3">
                                        <div className="flex gap-3 items-center">
                                            <input className={`${inputCls} flex-1`} value={section.title || ''} onChange={(e) => updateSection(index, 'title', e.target.value)} placeholder="Section title" />
                                            <button onClick={() => setProfile((prev) => ({ ...prev, sections: prev.sections.filter((_, idx) => idx !== index) }))} className="rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 p-3">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <textarea className={`${inputCls} min-h-[120px]`} value={section.body || ''} onChange={(e) => updateSection(index, 'body', e.target.value)} placeholder="Section details" />
                                    </div>
                                ))}
                                {!(profile.sections || []).length && <p className="text-sm text-slate-400">No sections added yet.</p>}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <div className="glass-card rounded-3xl p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <FileStack size={18} className="text-indigo-600" />
                                <h2 className="text-xl font-black dark:text-white">References & Maps</h2>
                            </div>

                            <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white/70">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Upload files</p>
                                <input type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} className={inputCls} />
                                <input className={inputCls} value={uploadMeta.title} onChange={(e) => setUploadMeta((prev) => ({ ...prev, title: e.target.value }))} placeholder="Optional title for first file" />
                                <div className="grid grid-cols-2 gap-3">
                                    <select className={inputCls} value={uploadMeta.category} onChange={(e) => setUploadMeta((prev) => ({ ...prev, category: e.target.value }))}>
                                        <option value="reference">Reference</option>
                                        <option value="map">Map</option>
                                        <option value="brief">Brief</option>
                                        <option value="dataset">Dataset</option>
                                    </select>
                                    <label className="flex items-center gap-2 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600">
                                        <input type="checkbox" checked={uploadMeta.is_map} onChange={(e) => setUploadMeta((prev) => ({ ...prev, is_map: e.target.checked }))} />
                                        Mark as map
                                    </label>
                                </div>
                                <button onClick={uploadDocs} disabled={uploading} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60">
                                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                    Upload Reference
                                </button>
                            </div>

                            <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white/70">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Add external link</p>
                                <input className={inputCls} value={linkForm.title} onChange={(e) => setLinkForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Map name / reference title" />
                                <input className={inputCls} value={linkForm.external_url} onChange={(e) => setLinkForm((prev) => ({ ...prev, external_url: e.target.value }))} placeholder="https://..." />
                                <div className="grid grid-cols-2 gap-3">
                                    <select className={inputCls} value={linkForm.category} onChange={(e) => setLinkForm((prev) => ({ ...prev, category: e.target.value }))}>
                                        <option value="reference">Reference</option>
                                        <option value="map">Map</option>
                                        <option value="brief">Brief</option>
                                        <option value="dataset">Dataset</option>
                                    </select>
                                    <label className="flex items-center gap-2 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600">
                                        <input type="checkbox" checked={linkForm.is_map} onChange={(e) => setLinkForm((prev) => ({ ...prev, is_map: e.target.checked }))} />
                                        Map link
                                    </label>
                                </div>
                                <button onClick={addLink} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50">
                                    <LinkIcon size={16} />
                                    Add Link
                                </button>
                            </div>
                        </div>

                        <div className="glass-card rounded-3xl p-6">
                            <h3 className="text-lg font-black dark:text-white mb-4">Document Library</h3>
                            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                {documents.map((doc) => (
                                    <div key={doc.id} className={`rounded-2xl border p-4 transition-colors ${selectedDocId === doc.id ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white/70'}`}>
                                        <button onClick={() => setSelectedDocId(doc.id)} className="w-full text-left">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-bold text-slate-800">{doc.title}</p>
                                                    <p className="text-xs text-slate-400 mt-1">{doc.category}{doc.is_map ? ' • map' : ''} • {formatDateTime(doc.created_at)}</p>
                                                    {!doc.external_url && <p className="text-xs text-slate-400 mt-1">{formatSize(doc.file_size)}</p>}
                                                </div>
                                                <div className="text-xs font-bold text-violet-600">{doc.analysis_status}</div>
                                            </div>
                                        </button>
                                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                                            {!doc.external_url && (
                                                <button onClick={() => analyzeDoc(doc)} className="px-2.5 py-1.5 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 inline-flex items-center gap-1">
                                                    <Brain size={13} /> Analyze
                                                </button>
                                            )}
                                            <button onClick={() => downloadDoc(doc)} className="px-2.5 py-1.5 rounded-xl bg-slate-50 text-slate-700 text-xs font-bold hover:bg-slate-100 inline-flex items-center gap-1">
                                                {doc.external_url ? <ExternalLink size={13} /> : <Download size={13} />} {doc.external_url ? 'Open' : 'Download'}
                                            </button>
                                            <button onClick={() => setSelectedDocId(doc.id)} className="px-2.5 py-1.5 rounded-xl bg-slate-50 text-slate-700 text-xs font-bold hover:bg-slate-100 inline-flex items-center gap-1">
                                                <Eye size={13} /> View
                                            </button>
                                            <button onClick={() => deleteDoc(doc)} className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 inline-flex items-center gap-1">
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {!documents.length && <p className="text-sm text-slate-400">No references uploaded yet.</p>}
                            </div>
                        </div>

                        <div className="glass-card rounded-3xl p-6">
                            <div className="flex items-center gap-2 mb-3">
                                {selectedDoc?.is_map ? <MapPinned size={18} className="text-emerald-600" /> : <FileText size={18} className="text-indigo-600" />}
                                <h3 className="text-lg font-black dark:text-white">Viewer</h3>
                            </div>
                            {!selectedDoc ? (
                                <p className="text-sm text-slate-400">Select a reference to preview it here.</p>
                            ) : (
                                <div className="space-y-3">
                                    <div>
                                        <p className="font-bold text-slate-800">{selectedDoc.title}</p>
                                        <p className="text-xs text-slate-400">{selectedDoc.category}{selectedDoc.is_map ? ' • map' : ''}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden h-[320px]">
                                        {previewUrl ? (
                                            previewMode === 'pdf' || previewMode === 'map' || previewMode === 'link' ? (
                                                <iframe title={selectedDoc.title} src={previewUrl} className="w-full h-full" />
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-sm text-slate-500 px-6 text-center">
                                                    Preview not available for this file type. Use Download/Open.
                                                </div>
                                            )
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-sm text-slate-400">Preview unavailable</div>
                                        )}
                                    </div>
                                    {selectedDoc.analysis_output && (
                                        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                                            <p className="text-xs font-black uppercase tracking-widest text-violet-500 mb-2">Latest Analysis</p>
                                            <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-[220px] overflow-y-auto">
                                                {selectedDoc.analysis_output}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default GeneralInfo;
