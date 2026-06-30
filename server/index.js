require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const database = require('./database');
const sheets = require('./sheets');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/sales', require('./routes/sales'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Channels endpoint (mounted under /api)
app.get('/api/channels', async (req, res) => {
    try {
        const channels = await sheets.getChannels();
        res.json({ success: true, data: channels });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
async function start() {
    try {
        // Initialize database
        await database.initDatabase();

        // Initialize Google Sheets
        sheets.initSheets();

        // Pre-cache menu
        await sheets.getMenuItems();

        app.listen(PORT, () => {
            console.log('');
            console.log('🚀 ═══════════════════════════════════════════');
            console.log('   MALIKA SMART BOOTH');
            console.log('   Kebab & Burger Management System');
            console.log('═══════════════════════════════════════════════');
            console.log(`   🌐 http://localhost:${PORT}`);
            console.log('   📋 POS Kasir  |  📊 Dashboard  |  💬 AI Chat');
            console.log('═══════════════════════════════════════════════');
            console.log('');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

start();
