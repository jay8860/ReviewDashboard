import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000');
const AUTH_URL = `${BASE_URL}/api/auth`;
const DEPT_URL = `${BASE_URL}/api/departments`;
const REVIEW_URL = `${BASE_URL}/api/reviews`;
const TASK_URL = `${BASE_URL}/api/tasks`;
const PLAN_URL = `${BASE_URL}/api/planner`;
const EMP_URL = `${BASE_URL}/api/employees`;

// Attach JWT token to all requests
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

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
    deleteAgendaPoint: async (deptId, apId) => {
        const res = await axios.delete(`${DEPT_URL}/${deptId}/agenda/${apId}`);
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
