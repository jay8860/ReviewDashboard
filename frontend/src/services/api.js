import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8001');
const AUTH_URL = `${BASE_URL}/api/auth`;
const DEPT_URL = `${BASE_URL}/api/departments`;
const REVIEW_URL = `${BASE_URL}/api/reviews`;
const TASK_URL = `${BASE_URL}/api/tasks`;
const PLAN_URL = `${BASE_URL}/api/planner`;
const EMP_URL = `${BASE_URL}/api/employees`;
const FIELD_VISIT_URL = `${BASE_URL}/api/field-visits`;
const TODO_URL = `${BASE_URL}/api/todos`;
const ANALYTICS_URL = `${BASE_URL}/api/analytics`;
const BACKUP_URL = `${BASE_URL}/api/backup`;

const readToken = () => {
    const raw = localStorage.getItem('token');
    if (!raw || raw === 'undefined' || raw === 'null') return '';
    const token = String(raw).trim().replace(/^['"]|['"]$/g, '');
    return token;
};

const clearSessionAndRedirect = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
    }
};

const extractErrorDetail = async (error) => {
    const data = error?.response?.data;
    if (typeof data?.detail === 'string') return data.detail;
    if (data instanceof Blob) {
        const text = await data.text();
        try {
            const parsed = JSON.parse(text);
            return typeof parsed?.detail === 'string' ? parsed.detail : '';
        } catch {
            return '';
        }
    }
    return '';
};

const appendFiles = (formData, fileOrFiles) => {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    files.filter(Boolean).forEach((file) => {
        formData.append('files', file);
    });
};

// Attach JWT token to all requests
axios.interceptors.request.use((config) => {
    const token = readToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// If backend rejects JWT, force fresh login
axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;
        const detail = await extractErrorDetail(error);
        const isAuthError = status === 401 && (
            detail === 'Invalid token' ||
            detail === 'Unauthorized' ||
            detail === 'Invalid token payload' ||
            detail === 'User not found' ||
            detail === ''
        );
        if (isAuthError) {
            clearSessionAndRedirect();
        }
        return Promise.reject(error);
    }
);

export const api = {
    // ── Auth ──────────────────────────────────────────────────────────────────
    login: async (credentials) => {
        const res = await axios.post(`${AUTH_URL}/login`, credentials);
        return res.data;
    },
    getHint: async (username) => {
        const res = await axios.get(`${AUTH_URL}/hint/${username}`);
        return res.data;
    },
    forgotPassword: async (email) => {
        const res = await axios.post(`${AUTH_URL}/forgot-password`, { email });
        return res.data;
    },
    resetPassword: async (data) => {
        const res = await axios.post(`${AUTH_URL}/reset-password`, data);
        return res.data;
    },
    getAccessModules: async () => {
        const res = await axios.get(`${AUTH_URL}/modules`);
        return res.data;
    },
    getUsers: async () => {
        const res = await axios.get(`${AUTH_URL}/users`);
        return res.data;
    },
    createUser: async (data) => {
        const res = await axios.post(`${AUTH_URL}/users`, data);
        return res.data;
    },
    updateUser: async (id, data) => {
        const res = await axios.put(`${AUTH_URL}/users/${id}`, data);
        return res.data;
    },
    deleteUser: async (id) => {
        const res = await axios.delete(`${AUTH_URL}/users/${id}`);
        return res.data;
    },

    // ── Departments ───────────────────────────────────────────────────────────
    getDepartments: async () => {
        const res = await axios.get(`${DEPT_URL}/`);
        return res.data;
    },
    getDepartment: async (id) => {
        const res = await axios.get(`${DEPT_URL}/${id}`);
        return res.data;
    },
    createDepartment: async (data) => {
        const res = await axios.post(`${DEPT_URL}/`, data);
        return res.data;
    },
    updateDepartment: async (id, data) => {
        const res = await axios.put(`${DEPT_URL}/${id}`, data);
        return res.data;
    },
    deleteDepartment: async (id) => {
        const res = await axios.delete(`${DEPT_URL}/${id}`);
        return res.data;
    },
    getDepartmentDocuments: async (deptId) => {
        const res = await axios.get(`${DEPT_URL}/${deptId}/documents`);
        return res.data;
    },
    uploadDepartmentDocument: async (deptId, fileOrFiles) => {
        const fd = new FormData();
        appendFiles(fd, fileOrFiles);
        const res = await axios.post(`${DEPT_URL}/${deptId}/documents`, fd);
        return res.data;
    },
    analyzeDepartmentDocument: async (deptId, docId, data) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/documents/${docId}/analyze`, data);
        return res.data;
    },
    suggestTasksFromDepartmentDocument: async (deptId, docId, data = {}) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/documents/${docId}/task-suggestions`, data);
        return res.data;
    },
    compareDepartmentDocumentAnalyses: async (deptId, data) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/documents/compare-analysis`, data);
        return res.data;
    },
    getDepartmentDocument: async (deptId, docId) => {
        const res = await axios.get(`${DEPT_URL}/${deptId}/documents/${docId}`);
        return res.data;
    },
    deleteDepartmentDocument: async (deptId, docId) => {
        const res = await axios.delete(`${DEPT_URL}/${deptId}/documents/${docId}`);
        return res.data;
    },
    downloadDepartmentDocument: async (deptId, docId) => {
        return axios.get(`${DEPT_URL}/${deptId}/documents/${docId}/download`, { responseType: 'blob' });
    },

    // ── Agenda Points ─────────────────────────────────────────────────────────
    getAgendaPoints: async (deptId) => {
        const res = await axios.get(`${DEPT_URL}/${deptId}/agenda`);
        return res.data;
    },
    createAgendaPoint: async (deptId, data) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/agenda`, data);
        return res.data;
    },
    updateAgendaPoint: async (deptId, apId, data) => {
        const res = await axios.put(`${DEPT_URL}/${deptId}/agenda/${apId}`, data);
        return res.data;
    },
    bulkUpdateAgendaPoints: async (deptId, data) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/agenda/bulk-update`, data);
        return res.data;
    },
    bulkCreateAgendaPoints: async (deptId, data) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/agenda/bulk-create`, data);
        return res.data;
    },
    deleteAgendaPoint: async (deptId, apId) => {
        const res = await axios.delete(`${DEPT_URL}/${deptId}/agenda/${apId}`);
        return res.data;
    },
    bulkDeleteAgendaPoints: async (deptId, data) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/agenda/bulk-delete`, data);
        return res.data;
    },

    // ── Department Meetings ────────────────────────────────────────────────────
    getMeetings: async (deptId) => {
        const res = await axios.get(`${DEPT_URL}/${deptId}/meetings`);
        return res.data;
    },
    createMeeting: async (deptId, data) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/meetings`, data);
        return res.data;
    },
    updateMeeting: async (deptId, meetingId, data) => {
        const res = await axios.put(`${DEPT_URL}/${deptId}/meetings/${meetingId}`, data);
        return res.data;
    },
    deleteMeeting: async (deptId, meetingId) => {
        const res = await axios.delete(`${DEPT_URL}/${deptId}/meetings/${meetingId}`);
        return res.data;
    },
    getMeetingDocuments: async (deptId, meetingId) => {
        const res = await axios.get(`${DEPT_URL}/${deptId}/meetings/${meetingId}/documents`);
        return res.data;
    },
    uploadMeetingDocument: async (deptId, meetingId, fileOrFiles) => {
        const fd = new FormData();
        appendFiles(fd, fileOrFiles);
        const res = await axios.post(`${DEPT_URL}/${deptId}/meetings/${meetingId}/documents`, fd);
        return res.data;
    },
    analyzeMeetingDocument: async (deptId, meetingId, docId, data) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/meetings/${meetingId}/documents/${docId}/analyze`, data);
        return res.data;
    },
    suggestTasksFromMeetingDocument: async (deptId, meetingId, docId, data = {}) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/meetings/${meetingId}/documents/${docId}/task-suggestions`, data);
        return res.data;
    },
    getMeetingDocument: async (deptId, meetingId, docId) => {
        const res = await axios.get(`${DEPT_URL}/${deptId}/meetings/${meetingId}/documents/${docId}`);
        return res.data;
    },
    deleteMeetingDocument: async (deptId, meetingId, docId) => {
        const res = await axios.delete(`${DEPT_URL}/${deptId}/meetings/${meetingId}/documents/${docId}`);
        return res.data;
    },
    downloadMeetingDocument: async (deptId, meetingId, docId) => {
        return axios.get(`${DEPT_URL}/${deptId}/meetings/${meetingId}/documents/${docId}/download`, { responseType: 'blob' });
    },

    // ── Department Data Grid ───────────────────────────────────────────────────
    getDataGrid: async (deptId) => {
        const res = await axios.get(`${DEPT_URL}/${deptId}/datagrid`);
        return res.data;
    },
    updateDataGrid: async (deptId, data) => {
        const res = await axios.put(`${DEPT_URL}/${deptId}/datagrid`, data);
        return res.data;
    },
    suggestTasksFromMeetingWorkspace: async (deptId, meetingId, data = {}) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/meetings/${meetingId}/task-suggestions`, data);
        return res.data;
    },
    confirmTaskSuggestions: async (deptId, data) => {
        const res = await axios.post(`${DEPT_URL}/${deptId}/task-suggestions/confirm`, data);
        return res.data;
    },

    // ── Review Programs ───────────────────────────────────────────────────────
    getPrograms: async (departmentId = null) => {
        const params = departmentId ? `?department_id=${departmentId}` : '';
        const res = await axios.get(`${REVIEW_URL}/programs${params}`);
        return res.data;
    },
    createProgram: async (data) => {
        const res = await axios.post(`${REVIEW_URL}/programs`, data);
        return res.data;
    },
    updateProgram: async (id, data) => {
        const res = await axios.put(`${REVIEW_URL}/programs/${id}`, data);
        return res.data;
    },
    deleteProgram: async (id) => {
        const res = await axios.delete(`${REVIEW_URL}/programs/${id}`);
        return res.data;
    },

    // ── Review Sessions ───────────────────────────────────────────────────────
    getSessions: async (programId = null) => {
        const params = programId ? `?program_id=${programId}` : '';
        const res = await axios.get(`${REVIEW_URL}/sessions${params}`);
        return res.data;
    },
    getSession: async (id) => {
        const res = await axios.get(`${REVIEW_URL}/sessions/${id}`);
        return res.data;
    },
    createSession: async (data) => {
        const res = await axios.post(`${REVIEW_URL}/sessions`, data);
        return res.data;
    },
    updateSession: async (id, data) => {
        const res = await axios.put(`${REVIEW_URL}/sessions/${id}`, data);
        return res.data;
    },
    deleteSession: async (id) => {
        const res = await axios.delete(`${REVIEW_URL}/sessions/${id}`);
        return res.data;
    },

    // ── Action Points ─────────────────────────────────────────────────────────
    createActionPoint: async (data) => {
        const res = await axios.post(`${REVIEW_URL}/action-points`, data);
        return res.data;
    },
    updateActionPoint: async (id, data) => {
        const res = await axios.put(`${REVIEW_URL}/action-points/${id}`, data);
        return res.data;
    },
    createTaskFromActionPoint: async (apId) => {
        const res = await axios.post(`${REVIEW_URL}/action-points/${apId}/create-task`);
        return res.data;
    },
    deleteActionPoint: async (id) => {
        const res = await axios.delete(`${REVIEW_URL}/action-points/${id}`);
        return res.data;
    },

    // ── Checklists ────────────────────────────────────────────────────────────
    getChecklistTemplates: async (programId) => {
        const res = await axios.get(`${REVIEW_URL}/checklist-templates/${programId}`);
        return res.data;
    },
    createChecklistTemplate: async (data) => {
        const res = await axios.post(`${REVIEW_URL}/checklist-templates`, data);
        return res.data;
    },
    deleteChecklistTemplate: async (id) => {
        const res = await axios.delete(`${REVIEW_URL}/checklist-templates/${id}`);
        return res.data;
    },
    updateChecklistResponse: async (id, data) => {
        const res = await axios.put(`${REVIEW_URL}/checklist-responses/${id}`, data);
        return res.data;
    },

    // ── Tasks ─────────────────────────────────────────────────────────────────
    getTasks: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.department_id) params.append('department_id', filters.department_id);
        if (filters.agency) params.append('agency', filters.agency);
        if (filters.status) params.append('status', filters.status);
        if (filters.search) params.append('search', filters.search);
        if (filters.sortBy) params.append('sort_by', filters.sortBy);
        if (filters.sortDir) params.append('sort_dir', filters.sortDir);
        if (filters.is_today !== undefined) params.append('is_today', filters.is_today);
        if (filters.is_pinned !== undefined) params.append('is_pinned', filters.is_pinned);
        params.append('t', Date.now());
        const res = await axios.get(`${TASK_URL}/?${params.toString()}`);
        return res.data;
    },
    getTaskStats: async () => {
        const res = await axios.get(`${TASK_URL}/stats`);
        return res.data;
    },
    getTaskAnalytics: async () => {
        const res = await axios.get(`${ANALYTICS_URL}/tasks`);
        return res.data;
    },
    downloadBackup: async () => {
        return axios.get(`${BACKUP_URL}/export`, { responseType: 'blob' });
    },
    getAgencies: async () => {
        const res = await axios.get(`${TASK_URL}/agencies`);
        return res.data;
    },
    createTask: async (data) => {
        const res = await axios.post(`${TASK_URL}/`, data);
        return res.data;
    },
    updateTask: async (id, data) => {
        const res = await axios.put(`${TASK_URL}/${id}`, data);
        return res.data;
    },
    bulkUpdateTasks: async (updates) => {
        const res = await axios.put(`${TASK_URL}/bulk/update`, { updates });
        return res.data;
    },
    deleteTask: async (id) => {
        const res = await axios.delete(`${TASK_URL}/${id}`);
        return res.data;
    },

    // ── Planner ───────────────────────────────────────────────────────────────
    getPlannerEvents: async (startDate = null, endDate = null) => {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        const res = await axios.get(`${PLAN_URL}/?${params.toString()}`);
        return res.data;
    },
    getPlannerSettings: async () => {
        const res = await axios.get(`${PLAN_URL}/settings`);
        return res.data;
    },
    updatePlannerSettings: async (data) => {
        const res = await axios.put(`${PLAN_URL}/settings`, data);
        return res.data;
    },
    rotatePlannerExportToken: async () => {
        const res = await axios.post(`${PLAN_URL}/settings/rotate-export-token`);
        return res.data;
    },
    syncPlannerIcs: async (data = {}) => {
        const res = await axios.post(`${PLAN_URL}/sync-ics`, data);
        return res.data;
    },
    createPlannerEvent: async (data) => {
        const res = await axios.post(`${PLAN_URL}/`, data);
        return res.data;
    },
    updatePlannerEvent: async (id, data) => {
        const res = await axios.put(`${PLAN_URL}/${id}`, data);
        return res.data;
    },
    deletePlannerEvent: async (id) => {
        const res = await axios.delete(`${PLAN_URL}/${id}`);
        return res.data;
    },

    // ── Field Visits ──────────────────────────────────────────────────────────
    getFieldVisitDrafts: async () => {
        const res = await axios.get(`${FIELD_VISIT_URL}/drafts`);
        return res.data;
    },
    getFieldVisitDraft: async (id) => {
        const res = await axios.get(`${FIELD_VISIT_URL}/drafts/${id}`);
        return res.data;
    },
    createFieldVisitDraft: async (data) => {
        const res = await axios.post(`${FIELD_VISIT_URL}/drafts`, data);
        return res.data;
    },
    updateFieldVisitDraft: async (id, data) => {
        const res = await axios.put(`${FIELD_VISIT_URL}/drafts/${id}`, data);
        return res.data;
    },
    deleteFieldVisitDraft: async (id) => {
        const res = await axios.delete(`${FIELD_VISIT_URL}/drafts/${id}`);
        return res.data;
    },
    reorderFieldVisitDrafts: async (ordered_ids = []) => {
        const res = await axios.post(`${FIELD_VISIT_URL}/drafts/reorder`, { ordered_ids });
        return res.data;
    },
    getFieldVisitPlanningNotes: async () => {
        const res = await axios.get(`${FIELD_VISIT_URL}/planning-notes`);
        return res.data;
    },
    getFieldVisitPlanningNoteItems: async () => {
        const res = await axios.get(`${FIELD_VISIT_URL}/planning-notes/items`);
        return res.data;
    },
    updateFieldVisitPlanningNotes: async (data) => {
        const res = await axios.put(`${FIELD_VISIT_URL}/planning-notes`, data);
        return res.data;
    },
    appendFieldVisitPlanningNoteLines: async (lines = []) => {
        const incoming = (lines || [])
            .map((line) => String(line || '').trim())
            .filter(Boolean);
        if (!incoming.length) {
            const res = await axios.get(`${FIELD_VISIT_URL}/planning-notes`);
            return res.data;
        }

        const existingRes = await axios.get(`${FIELD_VISIT_URL}/planning-notes`);
        const existing = existingRes.data || {};
        const existingLines = String(existing.note_text || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        const seen = new Set(existingLines.map((line) => line.toLowerCase()));
        const appended = [];
        incoming.forEach((line) => {
            const key = line.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            appended.push(line);
        });
        if (!appended.length) return existing;

        const payload = {
            note_text: [...existingLines, ...appended].join('\n'),
            home_base: existing.home_base || 'Collectorate, Dantewada',
        };
        const res = await axios.put(`${FIELD_VISIT_URL}/planning-notes`, payload);
        return res.data;
    },
    getFieldVisitSuggestions: async (data = {}) => {
        const res = await axios.post(`${FIELD_VISIT_URL}/suggestions`, data);
        return res.data;
    },
    getFieldVisitCoverage: async (district = '') => {
        const params = district ? `?district=${encodeURIComponent(district)}` : '';
        const res = await axios.get(`${FIELD_VISIT_URL}/coverage${params}`);
        return res.data;
    },
    markFieldVisitCoverage: async (data) => {
        const res = await axios.post(`${FIELD_VISIT_URL}/coverage/mark-visited`, data);
        return res.data;
    },
    clearFieldVisitCoverage: async (data) => {
        const res = await axios.post(`${FIELD_VISIT_URL}/coverage/clear-visits`, data);
        return res.data;
    },
    bulkUpsertGramPanchayats: async (items = []) => {
        const res = await axios.post(`${FIELD_VISIT_URL}/gram-panchayats/bulk-upsert`, { items });
        return res.data;
    },

    // ── To Do List ───────────────────────────────────────────────────────────
    getTodos: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        const res = await axios.get(`${TODO_URL}/?${params.toString()}`);
        return res.data;
    },
    createTodo: async (data) => {
        const res = await axios.post(`${TODO_URL}/`, data);
        return res.data;
    },
    updateTodo: async (id, data) => {
        const res = await axios.put(`${TODO_URL}/${id}`, data);
        return res.data;
    },
    deleteTodo: async (id) => {
        const res = await axios.delete(`${TODO_URL}/${id}`);
        return res.data;
    },
    importTodosFromText: async (data) => {
        const res = await axios.post(`${TODO_URL}/import-text`, data);
        return res.data;
    },
    reorderTodos: async (ordered_ids = []) => {
        const res = await axios.post(`${TODO_URL}/reorder`, { ordered_ids });
        return res.data;
    },
    convertTodoToTask: async (id, data = {}) => {
        const res = await axios.post(`${TODO_URL}/${id}/convert-to-task`, data);
        return res.data;
    },

    // ── Employees ─────────────────────────────────────────────────────────────
    getEmployees: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.department_id) params.append('department_id', filters.department_id);
        if (filters.search) params.append('search', filters.search);
        params.append('t', Date.now());
        const res = await axios.get(`${EMP_URL}/?${params.toString()}`);
        return res.data;
    },
    createEmployee: async (data) => {
        const res = await axios.post(`${EMP_URL}/`, data);
        return res.data;
    },
    updateEmployee: async (id, data) => {
        const res = await axios.put(`${EMP_URL}/${id}`, data);
        return res.data;
    },
    deleteEmployee: async (id) => {
        const res = await axios.delete(`${EMP_URL}/${id}`);
        return res.data;
    },
};
