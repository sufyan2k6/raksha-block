/* ==========================================================================
   RAKSHA BLOCK — TRAIN SCHEDULE REST API
   ========================================================================== */

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/trains
router.get('/', (req, res) => {
    const { corridor, search } = req.query;
    const trains = db.getAllTrains({ corridor, search });
    res.json({ count: trains.length, trains });
});

function parseMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

// POST /api/trains
router.post('/', (req, res) => {
    const { train_number, train_name, train_type, corridor, origin, destination, start_time, end_time } = req.body;
    
    if (!train_number || !train_type || !corridor || !start_time || !end_time) {
        return res.status(400).json({ error: 'Required fields missing: Train number, type, corridor, start and end times.' });
    }

    const startM = parseMinutes(start_time);
    const endM = parseMinutes(end_time);
    if (endM <= startM) {
        return res.status(400).json({ 
            error: 'Validation failed: Train arrival / end time must be after start time (overnight movements across midnight not supported in this daily prototype).' 
        });
    }

    try {
        const created = db.createTrain({
            train_number,
            train_name: train_name || train_number,
            train_type,
            corridor,
            origin: origin || 'Section Entry',
            destination: destination || 'Section Exit',
            start_time,
            end_time,
            status: 'Scheduled'
        });

        res.status(201).json({ message: 'Train added successfully.', train: created });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// PUT /api/trains/:id
router.put('/:id', (req, res) => {
    if (req.body.start_time && req.body.end_time) {
        if (parseMinutes(req.body.end_time) <= parseMinutes(req.body.start_time)) {
            return res.status(400).json({ error: 'Validation failed: Train arrival / end time must be after start time.' });
        }
    }
    const updated = db.updateTrain(req.params.id, req.body);
    if (!updated) {
        return res.status(404).json({ error: 'Train movement not found.' });
    }
    res.json({ message: 'Train updated successfully.', train: updated });
});

// DELETE /api/trains/:id
router.delete('/:id', (req, res) => {
    const success = db.deleteTrain(req.params.id);
    if (!success) {
        return res.status(404).json({ error: 'Train movement not found.' });
    }
    res.json({ message: 'Train movement deleted successfully.', id: req.params.id });
});

module.exports = router;
