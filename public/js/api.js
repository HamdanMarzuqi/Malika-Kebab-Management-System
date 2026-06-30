// API Client Helper
const API = {
    async get(url) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Request failed');
            return data.data;
        } catch (err) {
            console.error(`GET ${url} error:`, err);
            throw err;
        }
    },

    async post(url, body) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Request failed');
            return data.data;
        } catch (err) {
            console.error(`POST ${url} error:`, err);
            throw err;
        }
    },

    async delete(url) {
        try {
            const res = await fetch(url, { method: 'DELETE' });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Request failed');
            return data.data || data;
        } catch (err) {
            console.error(`DELETE ${url} error:`, err);
            throw err;
        }
    }
};

// Format currency
function formatRupiah(num) {
    if (num === null || num === undefined) return 'Rp 0';
    return 'Rp ' + Math.abs(num).toLocaleString('id-ID');
}

// Format short currency
function formatShort(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'jt';
    if (num >= 1000) return Math.round(num / 1000) + 'k';
    return num.toString();
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// Format time from datetime string
function formatTime(datetime) {
    if (!datetime) return '';
    const d = new Date(datetime);
    if (isNaN(d.getTime())) {
        // Try parsing "YYYY-MM-DD HH:MM:SS" format
        const parts = datetime.split(' ');
        if (parts.length === 2) {
            return parts[1].substring(0, 5);
        }
        return '';
    }
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// Menu category icons
const CATEGORY_ICONS = {
    'Kebab': '🥙',
    'Burger': '🍔',
    'Maryam': '🫓',
    'Snack': '🍢',
    'Extra': '➕',
    'Lainnya': '🍽️'
};

function getCategoryIcon(category) {
    return CATEGORY_ICONS[category] || '🍽️';
}
