// App Module - Main controller
const App = {
    currentPage: 'pos',

    async init() {
        this.bindNavigation();
        this.startClock();

        // Initialize modules
        await POS.init();
        Chat.init();

        console.log('🚀 Malika Smart Booth ready!');
    },

    bindNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.nav-btn[data-page="${page}"]`)?.classList.add('active');

        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`)?.classList.add('active');

        this.currentPage = page;

        // Lazy-load dashboard data
        if (page === 'dashboard') {
            Dashboard.init();
        }

        // Refresh history when back to POS
        if (page === 'pos') {
            POS.loadHistory();
        }
    },

    startClock() {
        const clockEl = document.getElementById('header-clock');
        const updateClock = () => {
            const now = new Date();
            const opts = {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            };
            clockEl.textContent = now.toLocaleDateString('id-ID', opts);
        };
        updateClock();
        setInterval(updateClock, 30000);
    }
};

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
