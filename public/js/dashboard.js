// Dashboard Module
const Dashboard = {
    charts: {},
    currentPeriod: 'today',
    weeklyRecapLoaded: false,
    weeklyRecapOpen: false,

    async init() {
        if (!this.initialized) {
            this.bindEvents();
            this.initialized = true;
        }
        await this.refresh();
    },

    bindEvents() {
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPeriod = btn.dataset.period;
                this.refresh();
            });
        });

        // Weekly recap toggle
        const toggleBtn = document.getElementById('weekly-recap-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleWeeklyRecap();
            });
        }
    },

    async toggleWeeklyRecap() {
        const dropdown = document.getElementById('weekly-recap-dropdown');
        const arrow = document.getElementById('weekly-recap-arrow');

        if (this.weeklyRecapOpen) {
            dropdown.classList.remove('open');
            arrow.classList.remove('open');
            this.weeklyRecapOpen = false;
        } else {
            dropdown.classList.add('open');
            arrow.classList.add('open');
            this.weeklyRecapOpen = true;

            // Load data if not loaded yet
            if (!this.weeklyRecapLoaded) {
                await this.loadWeeklyRecap();
            }
        }
    },

    async loadWeeklyRecap() {
        try {
            const data = await API.get('/api/dashboard/weekly-recap');
            this.renderWeeklyRecap(data);
            this.weeklyRecapLoaded = true;
        } catch (err) {
            console.error('Weekly recap error:', err);
            document.getElementById('weekly-recap-list').innerHTML =
                '<div class="loading-text">Gagal memuat data</div>';
        }
    },

    renderWeeklyRecap(days) {
        const container = document.getElementById('weekly-recap-list');

        // Reverse to show most recent first
        const reversed = [...days].reverse();

        const html = reversed.map(day => {
            const dateObj = new Date(day.date + 'T00:00:00');
            const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
            const dateFormatted = dateObj.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            const hasData = day.total_transactions > 0 || day.pengeluaran > 0;
            const isProfit = day.laba_bersih >= 0;

            if (!hasData) {
                return `
                    <div class="recap-day-card">
                        <div class="recap-day-header">
                            <span class="recap-day-name">${dayName}</span>
                            <span class="recap-day-date">${dateFormatted}</span>
                        </div>
                        <div class="recap-day-empty">Tidak ada transaksi</div>
                    </div>
                `;
            }

            return `
                <div class="recap-day-card">
                    <div class="recap-day-header">
                        <span class="recap-day-name">${dayName}</span>
                        <span class="recap-day-date">${dateFormatted}</span>
                    </div>
                    <div class="recap-day-body">
                        <div class="recap-row recap-row-full">
                            <span class="recap-label">📦 Total Transaksi</span>
                            <span class="recap-value trx">${day.total_transactions} transaksi</span>
                        </div>
                        <div class="recap-row-divider"></div>
                        <div class="recap-row">
                            <span class="recap-label">💵 Omzet Tunai</span>
                            <span class="recap-value tunai">${formatRupiah(day.omzet_tunai)}</span>
                        </div>
                        <div class="recap-row">
                            <span class="recap-label">📱 Omzet QRIS</span>
                            <span class="recap-value qris">${formatRupiah(day.omzet_qris)}</span>
                        </div>
                        <div class="recap-row">
                            <span class="recap-label">🟠 Omzet ShopeeFood</span>
                            <span class="recap-value shopee">${formatRupiah(day.omzet_shopee)}</span>
                        </div>
                        <div class="recap-row">
                            <span class="recap-label">💰 Total Omzet</span>
                            <span class="recap-value omzet">${formatRupiah(day.total_omzet)}</span>
                        </div>
                        <div class="recap-row-divider"></div>
                        <div class="recap-row">
                            <span class="recap-label">Potongan ShopeeFood</span>
                            <span class="recap-value potongan">- ${formatRupiah(day.potongan_shopee)}</span>
                        </div>
                        <div class="recap-row">
                            <span class="recap-label">Pengeluaran</span>
                            <span class="recap-value expense">- ${formatRupiah(day.pengeluaran)}</span>
                        </div>
                    </div>
                    <div class="recap-day-footer ${isProfit ? '' : 'negative'}">
                        <span class="recap-footer-label">💰 Laba Bersih</span>
                        <span class="recap-footer-value">${isProfit ? '' : '- '}${formatRupiah(day.laba_bersih)}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    async refresh() {
        // Reset weekly recap so it reloads fresh data
        this.weeklyRecapLoaded = false;
        if (this.weeklyRecapOpen) {
            await this.loadWeeklyRecap();
        }

        await Promise.all([
            this.loadSummary(),
            this.loadTrend(),
            this.loadTopMenu(),
            this.loadChannels(),
            this.loadHourly(),
            this.loadPayments()
        ]);
    },

    async loadSummary() {
        try {
            // Note: Our API getDailySummary only accepts a specific date right now.
            // For true period filtering, the backend needs an update to support it. 
            // We pass the current period as 'period' param to align with other APIs just in case it is updated later.
            const summary = await API.get(`/api/dashboard/summary?period=${this.currentPeriod}`);
            const expenses = await API.get(`/api/expenses/summary?period=${this.currentPeriod}`);

            document.getElementById('card-omzet').textContent = formatRupiah(summary.total_bersih || 0);
            document.getElementById('card-expense').textContent = formatRupiah(expenses.total_amount || 0);
            document.getElementById('card-profit').textContent = formatRupiah((summary.total_bersih || 0) - (expenses.total_amount || 0));
            document.getElementById('card-trx').textContent = summary.total_transactions || 0;
        } catch (err) {
            console.error('Summary error:', err);
        }
    },

    async loadTrend() {
        try {
            const days = this.currentPeriod === 'today' ? 7 : this.currentPeriod === 'week' ? 7 : 30;
            const data = await API.get(`/api/dashboard/trend?days=${days}`);

            this.renderChart('chart-trend', 'line', {
                labels: data.map(d => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                }),
                datasets: [{
                    label: 'Pendapatan Bersih',
                    data: data.map(d => d.bersih),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#f59e0b',
                }]
            });
        } catch (err) {
            console.error('Trend error:', err);
        }
    },

    async loadTopMenu() {
        try {
            const data = await API.get(`/api/dashboard/top-menu?period=${this.currentPeriod}&limit=6`);

            this.renderChart('chart-top-menu', 'bar', {
                labels: data.map(d => d.menu_name ? d.menu_name.replace('Kebab ', 'K.').replace('Burger ', 'B.').replace('Crispy ', 'C.') : ''),
                datasets: [{
                    label: 'Terjual',
                    data: data.map(d => d.total_qty),
                    backgroundColor: [
                        '#f59e0b', '#fbbf24', '#f97316', '#fb923c', '#10b981', '#3b82f6'
                    ],
                    borderRadius: 6,
                }]
            }, { indexAxis: 'y' });
        } catch (err) {
            console.error('Top menu error:', err);
        }
    },

    async loadChannels() {
        try {
            const data = await API.get(`/api/dashboard/channels?period=${this.currentPeriod}`);

            if (data.length === 0) {
                this.renderChart('chart-channels', 'doughnut', {
                    labels: ['Belum ada data'],
                    datasets: [{ data: [1], backgroundColor: ['#262626'] }]
                });
                return;
            }

            this.renderChart('chart-channels', 'doughnut', {
                labels: data.map(d => d.channel),
                datasets: [{
                    data: data.map(d => d.bersih),
                    backgroundColor: data.map(d => d.channel === 'ShopeeFood' ? '#ee4d2d' : '#f59e0b'),
                    borderWidth: 0,
                }]
            });
        } catch (err) {
            console.error('Channels error:', err);
        }
    },

    async loadHourly() {
        try {
            const data = await API.get('/api/dashboard/hourly');

            // Fill all hours
            const hours = Array.from({ length: 24 }, (_, i) => i);
            const hourlyData = hours.map(h => {
                const found = data.find(d => d.hour === h);
                return found ? found.revenue : 0;
            });

            // Only show hours 8-23
            const labels = hours.slice(8).map(h => `${h}:00`);
            const values = hourlyData.slice(8);

            this.renderChart('chart-hourly', 'bar', {
                labels,
                datasets: [{
                    label: 'Pendapatan',
                    data: values,
                    backgroundColor: values.map(v => v > 0 ? 'rgba(245, 158, 11, 0.6)' : 'rgba(38, 38, 38, 0.5)'),
                    borderRadius: 4,
                }]
            });
        } catch (err) {
            console.error('Hourly error:', err);
        }
    },

    async loadPayments() {
        try {
            const data = await API.get(`/api/dashboard/payments?period=${this.currentPeriod}`);

            if (data.length === 0) {
                this.renderChart('chart-payments', 'doughnut', {
                    labels: ['Belum ada data'],
                    datasets: [{ data: [1], backgroundColor: ['#262626'] }]
                });
                return;
            }

            const colors = { 'Tunai': '#10b981', 'QRIS': '#3b82f6', 'ShopeeFood': '#ee4d2d' };

            this.renderChart('chart-payments', 'doughnut', {
                labels: data.map(d => d.method),
                datasets: [{
                    data: data.map(d => d.revenue),
                    backgroundColor: data.map(d => colors[d.method] || '#737373'),
                    borderWidth: 0,
                }]
            });
        } catch (err) {
            console.error('Payments error:', err);
        }
    },

    renderChart(canvasId, type, data, extraOpts = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const isDoughnut = type === 'doughnut';

        this.charts[canvasId] = new Chart(ctx, {
            type,
            data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: isDoughnut,
                        position: 'bottom',
                        labels: {
                            color: '#a3a3a3',
                            font: { size: 11, family: 'Inter' },
                            padding: 12,
                            usePointStyle: true,
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1c1c1c',
                        titleColor: '#fafafa',
                        bodyColor: '#a3a3a3',
                        borderColor: '#262626',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        titleFont: { family: 'Inter', weight: '600' },
                        bodyFont: { family: 'Inter' },
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.y ?? context.parsed ?? context.raw;
                                if (typeof val === 'number' && val > 1000) {
                                    return ` ${context.dataset.label || context.label}: ${formatRupiah(val)}`;
                                }
                                return ` ${context.dataset.label || context.label}: ${val}`;
                            }
                        }
                    }
                },
                scales: isDoughnut ? {} : {
                    x: {
                        grid: { color: 'rgba(38,38,38,0.5)', drawBorder: false },
                        ticks: { color: '#737373', font: { size: 10, family: 'Inter' } },
                        ...extraOpts
                    },
                    y: {
                        grid: { color: 'rgba(38,38,38,0.5)', drawBorder: false },
                        ticks: {
                            color: '#737373',
                            font: { size: 10, family: 'Inter' },
                            callback: function(value) {
                                if (value >= 1000) return formatShort(value);
                                return value;
                            }
                        }
                    }
                },
                ...extraOpts
            }
        });
    }
};
