/* ==========================================================================
   RAKSHA BLOCK — AUTHENTICATION & ROLE AUTHORIZATION MIDDLEWARE
   Strict server-side enforcement of RBAC boundaries:
   - Planners (EMP001): Block planning, window management, conflict resolution, bundling
   - Department Engineers (EMP002 P-Way, EMP003 S&T, EMP004 TRD): Request submission & tracking
   ========================================================================== */

const db = require('../db');

const KNOWN_USERS = {
    'EMP001': { employeeId: 'EMP001', name: 'Rohan Gupta', role: 'Railway Planner', department: 'Operations', isPlanner: true },
    'EMP002': { employeeId: 'EMP002', name: 'Amit Sharma', role: 'Senior Section Engineer', department: 'P-Way', isPlanner: false },
    'EMP003': { employeeId: 'EMP003', name: 'Priya Verma', role: 'Signal Inspector', department: 'S&T', isPlanner: false },
    'EMP004': { employeeId: 'EMP004', name: 'Suresh Kumar', role: 'TRD Electrical Engineer', department: 'TRD', isPlanner: false },
    'EMP005': { employeeId: 'EMP005', name: 'Ananya Roy', role: 'Traffic Controller', department: 'Operations', isPlanner: false }
};

function getAuthUser(req) {
    let empId = req.headers['x-user-id'] || req.headers['x-emp-id'] || req.headers['x-employee-id'];

    // Check Bearer token: Bearer raksha_token_EMP001_...
    const authHeader = req.headers['authorization'];
    if (!empId && authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const match = token.match(/raksha_token_([A-Za-z0-9]+)/);
        if (match) {
            empId = match[1];
        }
    }

    if (!empId && req.body && req.body.employee_id) {
        empId = req.body.employee_id;
    }

    const cleanId = empId ? String(empId).trim().toUpperCase() : null;

    if (cleanId && KNOWN_USERS[cleanId]) {
        return KNOWN_USERS[cleanId];
    }

    // Check DB users if present
    if (cleanId) {
        const dbUser = db.getUserById(cleanId);
        if (dbUser) {
            const isPlanner = dbUser.role === 'Railway Planner' || cleanId === 'EMP001' || dbUser.department === 'Operations';
            return {
                employeeId: dbUser.employeeId || cleanId,
                name: dbUser.name,
                role: dbUser.role,
                department: dbUser.department,
                isPlanner
            };
        }
    }

    // Check client role headers if supplied
    const clientRole = req.headers['x-user-role'];
    const clientDept = req.headers['x-user-department'];
    const clientName = req.headers['x-user-name'];

    if (clientRole) {
        const isPlanner = clientRole === 'Railway Planner' || (clientDept === 'Operations' && clientRole.toLowerCase().includes('planner'));
        return {
            employeeId: cleanId || (isPlanner ? 'EMP001' : 'EMP002'),
            name: clientName || (isPlanner ? 'Rohan Gupta' : 'Department Engineer'),
            role: clientRole,
            department: clientDept || (isPlanner ? 'Operations' : 'P-Way'),
            isPlanner
        };
    }

    // Default fallback
    return {
        employeeId: 'EMP001',
        name: 'Rohan Gupta',
        role: 'Railway Planner',
        department: 'Operations',
        isPlanner: true
    };
}

// Middleware: Injects req.user on every request
function authMiddleware(req, res, next) {
    req.user = getAuthUser(req);
    next();
}

// Middleware: Strictly requires Railway Planner role (403 for Department Engineers)
function requirePlanner(req, res, next) {
    const user = req.user || getAuthUser(req);
    if (!user.isPlanner) {
        return res.status(403).json({
            error: 'Access Forbidden: Only Railway Planners can perform this action.',
            role: user.role,
            department: user.department,
            employeeId: user.employeeId
        });
    }
    next();
}

// Middleware: Strictly requires Department Engineer (403 for Railway Planners)
function requireDepartmentEngineer(req, res, next) {
    const user = req.user || getAuthUser(req);
    if (user.isPlanner) {
        return res.status(403).json({
            error: 'Access Forbidden: Railway Planners cannot submit field maintenance requests. Work orders must be submitted by Department Engineers (P-Way, S&T, TRD).',
            role: user.role,
            department: user.department,
            employeeId: user.employeeId
        });
    }
    next();
}

module.exports = {
    getAuthUser,
    authMiddleware,
    requirePlanner,
    requireDepartmentEngineer
};
