const { google } = require('googleapis');
const path = require('path');

let menuCache = null;
let channelCache = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fallback menu data (used when Google Sheets is not configured)
const FALLBACK_MENU = [];
const FALLBACK_CHANNELS = [];

let sheetsApi = null;
let sheetsConfigured = false;

function initSheets() {
    try {
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const sheetsId = process.env.GOOGLE_SHEETS_ID;

        if (!serviceAccountKey || !sheetsId) {
            console.log('⚠️  Google Sheets not configured. Using fallback menu data.');
            console.log('   To connect Google Sheets, set GOOGLE_SHEETS_ID and GOOGLE_SERVICE_ACCOUNT_KEY in .env');
            sheetsConfigured = false;
            return;
        }

        let credentials;
        try {
            credentials = JSON.parse(serviceAccountKey);
        } catch (e) {
            // Try reading as file path
            const fs = require('fs');
            const keyPath = path.resolve(serviceAccountKey);
            if (fs.existsSync(keyPath)) {
                credentials = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
            } else {
                console.log('⚠️  Invalid GOOGLE_SERVICE_ACCOUNT_KEY. Using fallback menu data.');
                sheetsConfigured = false;
                return;
            }
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        sheetsApi = google.sheets({ version: 'v4', auth });
        sheetsConfigured = true;
        console.log('✅ Google Sheets connected');
    } catch (err) {
        console.error('⚠️  Google Sheets init error:', err.message);
        sheetsConfigured = false;
    }
}

async function fetchMenuFromSheets() {
    if (!sheetsConfigured || !sheetsApi) return FALLBACK_MENU;

    try {
        const response = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: 'Menu!A2:E100', // Skip header row
        });

        const rows = response.data.values || [];
        return rows
            .filter(row => row.length >= 4)
            .map(row => ({
                menu: row[0],
                harga: parseInt(row[1]) || 0,
                kategori: row[2] || 'Lainnya',
                tipe: row[3] || 'Menu',
                aktif: (row[4] || 'Ya').toLowerCase() === 'ya',
            }))
            .filter(item => item.aktif);
    } catch (err) {
        console.error('Error fetching menu from Sheets:', err.message);
        return menuCache || FALLBACK_MENU;
    }
}

async function fetchChannelsFromSheets() {
    if (!sheetsConfigured || !sheetsApi) return FALLBACK_CHANNELS;

    try {
        const response = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: 'Channel!A2:C10', // Skip header row
        });

        const rows = response.data.values || [];
        return rows
            .filter(row => row.length >= 2)
            .map(row => ({
                channel: row[0],
                potongan_persen: parseInt(row[1]) || 0,
                aktif: (row[2] || 'Ya').toLowerCase() === 'ya',
            }))
            .filter(item => item.aktif);
    } catch (err) {
        console.error('Error fetching channels from Sheets:', err.message);
        return channelCache || FALLBACK_CHANNELS;
    }
}

async function getMenuItems(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && menuCache && (now - lastFetch) < CACHE_TTL) {
        return menuCache;
    }

    menuCache = await fetchMenuFromSheets();
    lastFetch = now;
    return menuCache;
}

async function getChannels(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && channelCache && (now - lastFetch) < CACHE_TTL) {
        return channelCache;
    }

    channelCache = await fetchChannelsFromSheets();
    return channelCache;
}

async function forceRefresh() {
    menuCache = null;
    channelCache = null;
    lastFetch = 0;
    const menu = await getMenuItems(true);
    const channels = await getChannels(true);
    return { menu, channels };
}

module.exports = {
    initSheets,
    getMenuItems,
    getChannels,
    forceRefresh,
    FALLBACK_MENU,
    FALLBACK_CHANNELS
};
