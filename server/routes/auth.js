/* ==========================================================================
   RAKSHA BLOCK — AUTHENTICATION & SESSION API
   Handles demo accounts, department bindings, and current user context
   ========================================================================== */

const express = require('express');
const router = express.Router();

const DEMO_USERS = [
    { 
        employeeId: 'EMP001', 
        email: 'planner@rakshablock.local',
        name: 'Rohan Gupta', 
        role: 'Railway Planner', 
        department: 'Operations', 
        passwords: ['planner123', 'demo123'] 
    },
    { 
        employeeId: 'EMP002', 
        email: 'pway@rakshablock.local',
        name: 'Amit Sharma', 
        role: 'Senior Section Engineer', 
        department: 'P-Way', 
        passwords: ['pway123', 'demo123'] 
    },
    { 
        employeeId: 'EMP003', 
        email: 'st@rakshablock.local',
        name: 'Priya Verma', 
        role: 'Signal Inspector', 
        department: 'S&T', 
        passwords: ['st123', 'demo123'] 
    },
    { 
        employeeId: 'EMP004', 
        email: 'trd@rakshablock.local',
        name: 'Suresh Kumar', 
        role: 'TRD Electrical Engineer', 
        department: 'TRD', 
        passwords: ['trd123', 'demo123'] 
    },
    { 
        employeeId: 'EMP005', 
        email: 'traffic@rakshablock.local',
        name: 'Ananya Roy', 
        role: 'Traffic Controller', 
        department: 'Operations', 
        passwords: ['traffic123', 'demo123'] 
    }
];

// POST /api/auth/login
router.post('/login', (req, res) => {
    // Robust parameter extraction supporting any frontend naming convention
    const empId = req.body.employee_id || req.body.employeeId || req.body.empId || req.body.email;
    const password = req.body.password || req.body.pass;
    
    if (!empId || !password) {
        return res.status(400).json({ error: 'Employee ID / Email and Password are required.' });
    }

    const cleanId = String(empId).trim().toLowerCase();
    const cleanPass = String(password).trim();

    const user = DEMO_USERS.find(u => 
        (u.employeeId.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) &&
        (u.passwords.includes(cleanPass))
    );

    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials. Please verify your Employee ID and Password.' });
    }

    // Return full user context
    res.json({
        success: true,
        token: `raksha_token_${user.employeeId}_${Date.now()}`,
        user: {
            employee_id: user.employeeId,
            employeeId: user.employeeId,
            name: user.name,
            role: user.role,
            department: user.department,
            email: user.email,
            isPlanner: user.role === 'Railway Planner' || user.employeeId === 'EMP001'
        }
    });
});

// GET /api/auth/users
router.get('/users', (req, res) => {
    res.json(DEMO_USERS.map(u => ({
        employeeId: u.employeeId,
        name: u.name,
        role: u.role,
        department: u.department,
        email: u.email
    })));
});

module.exports = router;
