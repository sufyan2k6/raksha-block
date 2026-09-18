require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { supabase } = require('./server/supabaseClient');

const authRoutes = require('./server/routes/auth');
const requestRoutes = require('./server/routes/requests');
const trainRoutes = require('./server/routes/trains');
const windowRoutes = require('./server/routes/windows');
const conflictRoutes = require('./server/routes/conflicts');
const coordinationRoutes = require('./server/routes/coordination');
const planningRoutes = require('./server/routes/planning');
const simulatorRoutes = require('./server/routes/simulator');
const aiRoutes = require('./server/routes/ai');
const reportRoutes = require('./server/routes/reports');
const db = require('./server/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static assets from root, css, js, assets, screens
app.use(express.static(path.join(__dirname)));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/screens', express.static(path.join(__dirname, 'screens')));

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/maintenance-requests', requestRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/block-windows', windowRoutes);
app.use('/api/conflicts', conflictRoutes);
app.use('/api/coordination', coordinationRoutes);
app.use('/api/block-plans', planningRoutes);
app.use('/api/what-if', simulatorRoutes);
app.use('/api/ai', aiRoutes);
app.use(['/api/reports', '/api/dashboard/summary'], reportRoutes);
app.use('/api/priority', requestRoutes);

app.get('/api/notifications', (req, res) => {
    res.json({ count: db.getNotifications().length, notifications: db.getNotifications() });
});

app.post('/api/sync', async (req, res) => {
    try {
        await db.reloadFromSupabase();
        res.json({ success: true, message: 'Synchronized with Supabase PostgreSQL.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'ONLINE',
        system: 'RAKSHA BLOCK - Railway Maintenance Planning',
        version: '4.0.0-COMPLETE-PROTOTYPE',
        timestamp: new Date().toISOString()
    });
});

// HTML Page Routes
app.get(['/', '/login'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'dashboard.html'));
});

app.get(['/requests', '/maintenance-requests'], (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'requests.html'));
});

app.get(['/priority-analysis', '/priority'], (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'priority-analysis.html'));
});

app.get(['/trains', '/train-schedule'], (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'trains.html'));
});

app.get(['/block-windows', '/windows'], (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'block-windows.html'));
});

app.get(['/conflicts', '/conflict-detection'], (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'conflicts.html'));
});

app.get(['/coordination', '/task-coordination'], (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'coordination.html'));
});

app.get(['/planning', '/block-planning'], (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'planning.html'));
});

app.get(['/simulator', '/what-if'], (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'simulator.html'));
});

app.get(['/ai', '/raksha-ai'], (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'ai.html'));
});

app.get('/reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'reports.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'screens', 'settings.html'));
});

// Start Server
const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 RAKSHA BLOCK Server running at: http://localhost:${PORT}`);
    console.log(`=======================================================`);
    console.log(`🔐 Login Page:               http://localhost:${PORT}/`);
    console.log(`📊 Dashboard Page:           http://localhost:${PORT}/dashboard`);
    console.log(`🛠️ Maintenance Requests:    http://localhost:${PORT}/requests`);
    console.log(`=======================================================`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        const altPort = 3001;
        console.log(`Port ${PORT} in use, trying http://localhost:${altPort}...`);
        app.listen(altPort, () => {
            console.log(`🚀 RAKSHA BLOCK Server running at: http://localhost:${altPort}`);
        });
    } else {
        console.error('Server error:', err);
    }
});
