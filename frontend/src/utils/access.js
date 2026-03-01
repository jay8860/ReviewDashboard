export const MODULE_CONFIG = [
    { key: 'overview', label: 'Overview', path: '/' },
    { key: 'tasks', label: 'Tasks', path: '/tasks' },
    { key: 'analytics', label: 'Analytics', path: '/analytics' },
    { key: 'employees', label: 'Employees', path: '/employees' },
    { key: 'departments', label: 'Departments', path: '/departments' },
    { key: 'field_visits', label: 'Field Visits', path: '/field-visits' },
    { key: 'todos', label: 'To Do List', path: '/todos' },
    { key: 'planner', label: 'Planner', path: '/planner' },
];

export const MODULE_KEYS = MODULE_CONFIG.map((item) => item.key);

const normalizeModuleKey = (value) => {
    if (!value) return '';
    return String(value).trim().toLowerCase().replace(/[-\s]+/g, '_');
};

export const getUserModules = (user) => {
    if (!user) return [];
    const rawModules = Array.isArray(user.module_access) ? user.module_access : [];
    const normalized = rawModules
        .map(normalizeModuleKey)
        .filter((item, index, arr) => item && arr.indexOf(item) === index && MODULE_KEYS.includes(item));
    if (user.role === 'admin') {
        return normalized.length > 0 ? normalized : MODULE_KEYS;
    }
    return normalized.length > 0 ? normalized : ['tasks', 'employees'];
};

export const canAccessModule = (user, moduleKey) => {
    if (!user) return false;
    const key = normalizeModuleKey(moduleKey);
    return getUserModules(user).includes(key);
};

export const getDefaultPathForUser = (user) => {
    if (!user) return '/login';
    const modules = getUserModules(user);
    const firstAllowed = MODULE_CONFIG.find((item) => modules.includes(item.key));
    if (firstAllowed?.path) return firstAllowed.path;
    return user.role === 'admin' ? '/' : '/tasks';
};
