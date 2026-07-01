const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'malika.db');

let db = null;

async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing DB or create new
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL,
            payment_method TEXT DEFAULT NULL,
            subtotal INTEGER NOT NULL,
            channel_cut_percent REAL DEFAULT 0,
            channel_cut INTEGER DEFAULT 0,
            total INTEGER NOT NULL,
            notes TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT (datetime('now', '+7 hours'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            menu_name TEXT NOT NULL,
            category TEXT NOT NULL,
            price INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            subtotal INTEGER NOT NULL,
            extras TEXT DEFAULT NULL,
            extras_total INTEGER DEFAULT 0,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            amount INTEGER NOT NULL,
            category TEXT DEFAULT 'Lainnya',
            created_at DATETIME DEFAULT (datetime('now', '+7 hours'))
        )
    `);

    saveDb();
    console.log('✅ Database initialized');
    return db;
}

function saveDb() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
}

// Helper to run queries and auto-save
function run(sql, params = []) {
    db.run(sql, params);
    saveDb();
}

function get(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
    }
    stmt.free();
    return null;
}

function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

// ==================== SALES ====================

function insertSale(data) {
    if (data.channel === 'ShopeeFood') {
        const subtotal = data.shopee_total;
        const channelCutPercent = 25;
        const channelCut = Math.round(subtotal * 0.25);
        const total = subtotal - channelCut;

        run(`
            INSERT INTO sales (channel, payment_method, subtotal, channel_cut_percent, channel_cut, total, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['ShopeeFood', null, subtotal, channelCutPercent, channelCut, total, data.notes || null]);

        const result = get('SELECT last_insert_rowid() as id');
        return {
            id: result.id,
            channel: 'ShopeeFood',
            subtotal,
            channel_cut: channelCut,
            total,
            notes: data.notes
        };
    } else {
        // Langsung
        const items = data.items || [];
        let subtotal = 0;

        for (const item of items) {
            const extrasTotal = (item.extras || []).reduce((sum, e) => sum + e.price, 0);
            const itemSubtotal = (item.price * item.quantity) + (extrasTotal * item.quantity);
            subtotal += itemSubtotal;
        }

        const total = subtotal;

        run(`
            INSERT INTO sales (channel, payment_method, subtotal, channel_cut_percent, channel_cut, total, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['Langsung', data.payment_method || 'Tunai', subtotal, 0, 0, total, data.notes || null]);

        const saleResult = get('SELECT last_insert_rowid() as id');
        const saleId = saleResult.id;

        for (const item of items) {
            const extrasTotal = (item.extras || []).reduce((sum, e) => sum + e.price, 0);
            const itemSubtotal = (item.price * item.quantity) + (extrasTotal * item.quantity);

            run(`
                INSERT INTO sale_items (sale_id, menu_name, category, price, quantity, subtotal, extras, extras_total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [saleId, item.menu_name, item.category || 'Lainnya', item.price, item.quantity, itemSubtotal,
                item.extras ? JSON.stringify(item.extras) : null, extrasTotal * item.quantity]);
        }

        return { id: saleId, channel: 'Langsung', payment_method: data.payment_method, subtotal, total };
    }
}

function deleteSale(id) {
    run('DELETE FROM sale_items WHERE sale_id = ?', [id]);
    run('DELETE FROM sales WHERE id = ?', [id]);
    return { deleted: true };
}

function getSalesToday() {
    const sales = all(`
        SELECT * FROM sales
        WHERE date(created_at) = date('now', '+7 hours')
        ORDER BY created_at DESC
    `);

    for (const sale of sales) {
        if (sale.channel === 'Langsung') {
            sale.items = all('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
            for (const item of sale.items) {
                item.extras = item.extras ? JSON.parse(item.extras) : [];
            }
        }
    }

    return sales;
}

function getSalesSummary(period = 'today') {
    const dateFilter = getDateFilter(period);
    return get(`
        SELECT
            COUNT(*) as total_transactions,
            COALESCE(SUM(subtotal), 0) as total_omzet,
            COALESCE(SUM(channel_cut), 0) as total_potongan,
            COALESCE(SUM(total), 0) as total_bersih
        FROM sales WHERE ${dateFilter}
    `) || { total_transactions: 0, total_omzet: 0, total_potongan: 0, total_bersih: 0 };
}

function getTopMenuItems(period = 'today', limit = 10) {
    const dateFilter = getDateFilter(period, 's');
    return all(`
        SELECT
            si.menu_name,
            si.category,
            SUM(si.quantity) as total_qty,
            SUM(si.subtotal) as total_revenue
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE ${dateFilter} AND s.channel = 'Langsung'
        GROUP BY si.menu_name
        ORDER BY total_qty DESC
        LIMIT ?
    `, [limit]);
}

function getChannelComparison(period = 'today') {
    const dateFilter = getDateFilter(period);
    return all(`
        SELECT
            channel,
            COUNT(*) as transactions,
            COALESCE(SUM(subtotal), 0) as omzet,
            COALESCE(SUM(channel_cut), 0) as potongan,
            COALESCE(SUM(total), 0) as bersih
        FROM sales WHERE ${dateFilter}
        GROUP BY channel
    `);
}

function getHourlySales(date = null) {
    const dateFilter = date
        ? `date(created_at) = date('${date}')`
        : "date(created_at) = date('now', '+7 hours')";

    return all(`
        SELECT
            CAST(strftime('%H', created_at) AS INTEGER) as hour,
            COUNT(*) as transactions,
            COALESCE(SUM(total), 0) as revenue
        FROM sales WHERE ${dateFilter}
        GROUP BY hour ORDER BY hour
    `);
}

function getPaymentMethodSummary(period = 'today') {
    const dateFilter = getDateFilter(period);
    return all(`
        SELECT
            CASE
                WHEN channel = 'ShopeeFood' THEN 'ShopeeFood'
                ELSE payment_method
            END as method,
            COUNT(*) as transactions,
            COALESCE(SUM(total), 0) as revenue
        FROM sales WHERE ${dateFilter}
        GROUP BY method
    `);
}

function getDailyTrend(days = 7) {
    return all(`
        SELECT
            date(created_at) as date,
            COUNT(*) as transactions,
            COALESCE(SUM(subtotal), 0) as omzet,
            COALESCE(SUM(channel_cut), 0) as potongan,
            COALESCE(SUM(total), 0) as bersih
        FROM sales
        WHERE date(created_at) >= date('now', '+7 hours', '-' || ? || ' days')
        GROUP BY date(created_at)
        ORDER BY date
    `, [days]);
}

// ==================== EXPENSES ====================

function insertExpense(data) {
    run(`
        INSERT INTO expenses (description, amount, category)
        VALUES (?, ?, ?)
    `, [data.description, data.amount, data.category || 'Lainnya']);

    const result = get('SELECT last_insert_rowid() as id');
    return { id: result.id, ...data };
}

function deleteExpense(id) {
    run('DELETE FROM expenses WHERE id = ?', [id]);
    return { deleted: true };
}

function getExpensesToday() {
    return all(`
        SELECT * FROM expenses
        WHERE date(created_at) = date('now', '+7 hours')
        ORDER BY created_at DESC
    `);
}

function getExpensesSummary(period = 'today') {
    const dateFilter = getDateFilter(period);

    const summary = get(`
        SELECT
            COUNT(*) as total_entries,
            COALESCE(SUM(amount), 0) as total_amount
        FROM expenses WHERE ${dateFilter}
    `) || { total_entries: 0, total_amount: 0 };

    const by_category = all(`
        SELECT category, COUNT(*) as entries, COALESCE(SUM(amount), 0) as amount
        FROM expenses WHERE ${dateFilter}
        GROUP BY category ORDER BY amount DESC
    `);

    return { ...summary, by_category };
}

function getLastExpense() {
    return get('SELECT * FROM expenses ORDER BY id DESC LIMIT 1');
}

// ==================== DASHBOARD ====================

function getDailySummary(date = null) {
    const dateFilter = date
        ? `date(created_at) = date('${date}')`
        : "date(created_at) = date('now', '+7 hours')";

    const sales = get(`
        SELECT
            COUNT(*) as total_transactions,
            COALESCE(SUM(subtotal), 0) as total_omzet,
            COALESCE(SUM(channel_cut), 0) as total_potongan,
            COALESCE(SUM(total), 0) as total_bersih
        FROM sales WHERE ${dateFilter}
    `) || { total_transactions: 0, total_omzet: 0, total_potongan: 0, total_bersih: 0 };

    const expenses = get(`
        SELECT COALESCE(SUM(amount), 0) as total_expenses
        FROM expenses WHERE ${dateFilter}
    `) || { total_expenses: 0 };

    return {
        ...sales,
        total_expenses: expenses.total_expenses,
        laba_bersih: sales.total_bersih - expenses.total_expenses
    };
}

// ==================== WEEKLY RECAP ====================

function getWeeklyDetailedRecap() {
    // Get last 7 days of data with detailed breakdown per day
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const dateOffset = `-${i} days`;
        const dateFilter = `date(created_at) = date('now', '+7 hours', '${dateOffset}')`;

        // Get the actual date string
        const dateRow = get(`SELECT date('now', '+7 hours', '${dateOffset}') as date_val`);
        const dateStr = dateRow ? dateRow.date_val : '';

        // Sales summary
        const salesSummary = get(`
            SELECT
                COUNT(*) as total_transactions,
                COALESCE(SUM(subtotal), 0) as total_omzet,
                COALESCE(SUM(channel_cut), 0) as total_potongan,
                COALESCE(SUM(total), 0) as total_bersih
            FROM sales WHERE ${dateFilter}
        `) || { total_transactions: 0, total_omzet: 0, total_potongan: 0, total_bersih: 0 };

        // Omzet per payment method
        const tunai = get(`
            SELECT COALESCE(SUM(total), 0) as revenue
            FROM sales WHERE ${dateFilter} AND channel = 'Langsung' AND payment_method = 'Tunai'
        `) || { revenue: 0 };

        const qris = get(`
            SELECT COALESCE(SUM(total), 0) as revenue
            FROM sales WHERE ${dateFilter} AND channel = 'Langsung' AND payment_method = 'QRIS'
        `) || { revenue: 0 };

        const shopee = get(`
            SELECT COALESCE(SUM(subtotal), 0) as omzet, COALESCE(SUM(channel_cut), 0) as potongan, COALESCE(SUM(total), 0) as bersih
            FROM sales WHERE ${dateFilter} AND channel = 'ShopeeFood'
        `) || { omzet: 0, potongan: 0, bersih: 0 };

        // Expenses
        const expenses = get(`
            SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses WHERE ${dateFilter}
        `) || { total_expenses: 0 };

        days.push({
            date: dateStr,
            total_transactions: salesSummary.total_transactions,
            omzet_tunai: tunai.revenue,
            omzet_qris: qris.revenue,
            omzet_shopee: shopee.omzet,
            total_omzet: salesSummary.total_omzet,
            potongan_shopee: shopee.potongan,
            total_bersih: salesSummary.total_bersih,
            pengeluaran: expenses.total_expenses,
            laba_bersih: salesSummary.total_bersih - expenses.total_expenses
        });
    }

    return days;
}

// ==================== HELPERS ====================

function getDateFilter(period, tableAlias = null) {
    const col = tableAlias ? `${tableAlias}.created_at` : 'created_at';
    switch (period) {
        case 'today': return `date(${col}) = date('now', '+7 hours')`;
        case 'yesterday': return `date(${col}) = date('now', '+7 hours', '-1 day')`;
        case 'week': return `date(${col}) >= date('now', '+7 hours', '-7 days')`;
        case 'month': return `date(${col}) >= date('now', '+7 hours', '-30 days')`;
        case 'all': return '1=1';
        default: return `date(${col}) = date('now', '+7 hours')`;
    }
}

module.exports = {
    initDatabase,
    insertSale, deleteSale, getSalesToday, getSalesSummary,
    getTopMenuItems, getChannelComparison, getHourlySales,
    getPaymentMethodSummary, getDailyTrend,
    insertExpense, deleteExpense, getExpensesToday, getExpensesSummary, getLastExpense,
    getDailySummary, getWeeklyDetailedRecap
};
