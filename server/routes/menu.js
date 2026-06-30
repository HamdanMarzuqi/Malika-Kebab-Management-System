const express = require('express');
const router = express.Router();
const sheets = require('../sheets');

// GET /api/menu - Get menu items
router.get('/', async (req, res) => {
    try {
        const items = await sheets.getMenuItems();
        const menu = items.filter(i => i.tipe === 'Menu');
        const extras = items.filter(i => i.tipe === 'Extra');

        // Group by category
        const grouped = {};
        for (const item of menu) {
            if (!grouped[item.kategori]) grouped[item.kategori] = [];
            grouped[item.kategori].push(item);
        }

        res.json({ success: true, data: { menu: grouped, extras, all: items } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/channels - Get channels
router.get('/channels', async (req, res) => {
    try {
        const channels = await sheets.getChannels();
        res.json({ success: true, data: channels });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/menu/refresh - Force refresh cache
router.post('/refresh', async (req, res) => {
    try {
        const data = await sheets.forceRefresh();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
