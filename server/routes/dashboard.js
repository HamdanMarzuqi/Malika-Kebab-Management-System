const express = require('express');
const router = express.Router();
const database = require('../database');

// GET /api/dashboard/summary - Daily summary cards
router.get('/summary', (req, res) => {
    try {
        const date = req.query.date || null;
        const summary = database.getDailySummary(date);
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/dashboard/trend - Sales trend
router.get('/trend', (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const trend = database.getDailyTrend(days);
        res.json({ success: true, data: trend });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/dashboard/top-menu - Top selling menu items
router.get('/top-menu', (req, res) => {
    try {
        const period = req.query.period || 'today';
        const limit = parseInt(req.query.limit) || 10;
        const items = database.getTopMenuItems(period, limit);
        res.json({ success: true, data: items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/dashboard/channels - Channel comparison
router.get('/channels', (req, res) => {
    try {
        const period = req.query.period || 'today';
        const data = database.getChannelComparison(period);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/dashboard/hourly - Hourly sales
router.get('/hourly', (req, res) => {
    try {
        const date = req.query.date || null;
        const data = database.getHourlySales(date);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/dashboard/payments - Payment method breakdown
router.get('/payments', (req, res) => {
    try {
        const period = req.query.period || 'today';
        const data = database.getPaymentMethodSummary(period);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/dashboard/weekly-recap - Detailed weekly recap per day
router.get('/weekly-recap', (req, res) => {
    try {
        const data = database.getWeeklyDetailedRecap();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
