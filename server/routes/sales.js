const express = require('express');
const router = express.Router();
const database = require('../database');

// POST /api/sales - Create new sale
router.post('/', (req, res) => {
    try {
        const result = database.insertSale(req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error creating sale:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/sales/today - Get today's sales
router.get('/today', (req, res) => {
    try {
        const sales = database.getSalesToday();
        res.json({ success: true, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/sales/summary - Get sales summary
router.get('/summary', (req, res) => {
    try {
        const period = req.query.period || 'today';
        const summary = database.getSalesSummary(period);
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/sales/:id - Delete a sale
router.delete('/:id', (req, res) => {
    try {
        database.deleteSale(parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
