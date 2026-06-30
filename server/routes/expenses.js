const express = require('express');
const router = express.Router();
const database = require('../database');

// POST /api/expenses - Create new expense
router.post('/', (req, res) => {
    try {
        const result = database.insertExpense(req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/expenses/today - Get today's expenses
router.get('/today', (req, res) => {
    try {
        const expenses = database.getExpensesToday();
        res.json({ success: true, data: expenses });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/expenses/summary - Get expense summary
router.get('/summary', (req, res) => {
    try {
        const period = req.query.period || 'today';
        const summary = database.getExpensesSummary(period);
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/expenses/:id - Delete an expense
router.delete('/:id', (req, res) => {
    try {
        database.deleteExpense(parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
