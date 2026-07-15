// POS Module
const POS = {
    menu: [],
    extras: [],
    cart: [],
    selectedChannel: 'Langsung',
    selectedPayment: 'Tunai',
    selectedCategory: null,

    async init() {
        await this.loadMenu();
        this.bindEvents();
        this.loadHistory();
        this.initMobileUI();
    },

    isMobile() {
        return window.innerWidth < 768;
    },

    async loadMenu() {
        try {
            const data = await API.get('/api/menu');
            this.menu = [];
            this.extras = data.extras || [];

            // Flatten grouped menu
            for (const [category, items] of Object.entries(data.menu)) {
                for (const item of items) {
                    this.menu.push(item);
                }
            }

            this.renderCategoryTabs();
            this.renderMenu();
        } catch (err) {
            console.error('Failed to load menu:', err);
            showToast('Gagal memuat menu', 'error');
        }
    },

    renderCategoryTabs() {
        const categories = [...new Set(this.menu.map(m => m.kategori))];
        const container = document.getElementById('category-tabs');

        container.innerHTML = `
            <button class="category-tab active" data-cat="all">Semua</button>
            ${categories.map(cat =>
                `<button class="category-tab" data-cat="${cat}">${getCategoryIcon(cat)} ${cat}</button>`
            ).join('')}
        `;

        container.querySelectorAll('.category-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedCategory = btn.dataset.cat === 'all' ? null : btn.dataset.cat;
                this.renderMenu();
            });
        });
    },

    renderMenu() {
        const grid = document.getElementById('menu-grid');
        const items = this.selectedCategory
            ? this.menu.filter(m => m.kategori === this.selectedCategory)
            : this.menu;

        grid.innerHTML = items.map(item => `
            <div class="menu-item" data-menu="${item.menu}" data-price="${item.harga}" data-category="${item.kategori}">
                <span class="menu-item-icon">${getCategoryIcon(item.kategori)}</span>
                <span class="menu-item-name">${item.menu}</span>
                <span class="menu-item-price">${formatShort(item.harga)}</span>
            </div>
        `).join('');

        grid.querySelectorAll('.menu-item').forEach(el => {
            el.addEventListener('click', () => {
                const name = el.dataset.menu;
                const price = parseInt(el.dataset.price);
                const category = el.dataset.category;

                // Check if kebab for extras
                if (category === 'Kebab' && this.extras.length > 0) {
                    this.showExtrasModal(name, price, category);
                } else {
                    this.addToCart(name, price, category, []);
                }
            });
        });
    },

    showExtrasModal(menuName, price, category) {
        const modal = document.getElementById('extras-modal');
        const title = document.getElementById('extras-modal-title');
        const list = document.getElementById('extras-list');

        title.textContent = `Extras untuk ${menuName}`;
        list.innerHTML = this.extras.map(ext => `
            <div class="extra-option" data-name="${ext.menu}" data-price="${ext.harga}">
                <div class="extra-checkbox"></div>
                <span class="extra-name">${ext.menu}</span>
                <span class="extra-price">+${formatRupiah(ext.harga)}</span>
            </div>
        `).join('');

        list.querySelectorAll('.extra-option').forEach(opt => {
            opt.addEventListener('click', () => opt.classList.toggle('selected'));
        });

        modal.style.display = 'flex';

        // Handle confirm
        const confirmBtn = document.getElementById('btn-extras-confirm');
        const cancelBtn = document.getElementById('btn-extras-cancel');

        const onConfirm = () => {
            const selectedExtras = [];
            list.querySelectorAll('.extra-option.selected').forEach(opt => {
                selectedExtras.push({ name: opt.dataset.name, price: parseInt(opt.dataset.price) });
            });
            this.addToCart(menuName, price, category, selectedExtras);
            modal.style.display = 'none';
            cleanup();
        };

        const onCancel = () => {
            // Cancel - don't add anything
            modal.style.display = 'none';
            cleanup();
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    },

    addToCart(name, price, category, extras) {
        // Check if same item with same extras exists
        const extrasKey = extras.map(e => e.name).sort().join(',');
        const existing = this.cart.find(item =>
            item.menu_name === name &&
            item.extras.map(e => e.name).sort().join(',') === extrasKey
        );

        if (existing) {
            existing.quantity++;
        } else {
            this.cart.push({
                menu_name: name,
                price,
                category,
                quantity: 1,
                extras: extras
            });
        }

        this.renderCart();
        showToast(`${name} ditambahkan`, 'success');
    },

    renderCart() {
        const container = document.getElementById('cart-items');
        const totalEl = document.getElementById('cart-total');
        const checkoutBtn = document.getElementById('btn-checkout');
        
        // Also get mobile sheet elements
        const sheetItems = document.getElementById('cart-sheet-items');
        const sheetTotal = document.getElementById('cart-sheet-total');
        const sheetCheckout = document.getElementById('btn-checkout-mobile');

        if (this.cart.length === 0) {
            const emptyHTML = `
                <div class="cart-empty">
                    <span>🛒</span>
                    <p>Keranjang kosong</p>
                    <p class="cart-empty-sub">Tap menu untuk menambahkan</p>
                </div>
            `;
            container.innerHTML = emptyHTML;
            if (sheetItems) sheetItems.innerHTML = emptyHTML;
            totalEl.textContent = 'Rp 0';
            if (sheetTotal) sheetTotal.textContent = 'Rp 0';
            checkoutBtn.disabled = true;
            if (sheetCheckout) sheetCheckout.disabled = true;
            this.updateFloatingBar();
            return;
        }

        let grandTotal = 0;

        const cartHTML = this.cart.map((item, idx) => {
            const extrasTotal = item.extras.reduce((sum, e) => sum + e.price, 0);
            const itemTotal = (item.price + extrasTotal) * item.quantity;
            grandTotal += itemTotal;

            const extrasText = item.extras.map(e => `+${e.name.replace('Extra ', '')}`).join(', ');

            return `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.menu_name}</div>
                        ${extrasText ? `<div class="cart-item-extras">${extrasText}</div>` : ''}
                        <div class="cart-item-price">${formatRupiah(item.price + extrasTotal)} × ${item.quantity}</div>
                    </div>
                    <div class="cart-qty">
                        <button onclick="POS.updateQty(${idx}, -1)">−</button>
                        <span>${item.quantity}</span>
                        <button onclick="POS.updateQty(${idx}, 1)">+</button>
                    </div>
                    <button class="cart-item-remove" onclick="POS.removeFromCart(${idx})">✕</button>
                </div>
            `;
        }).join('');

        container.innerHTML = cartHTML;
        if (sheetItems) sheetItems.innerHTML = cartHTML;
        
        totalEl.textContent = formatRupiah(grandTotal);
        if (sheetTotal) sheetTotal.textContent = formatRupiah(grandTotal);
        checkoutBtn.disabled = false;
        if (sheetCheckout) sheetCheckout.disabled = false;
        
        this.updateFloatingBar();
    },

    updateQty(idx, delta) {
        this.cart[idx].quantity += delta;
        if (this.cart[idx].quantity <= 0) {
            this.cart.splice(idx, 1);
        }
        this.renderCart();
    },

    removeFromCart(idx) {
        this.cart.splice(idx, 1);
        this.renderCart();
    },

    clearCart() {
        this.cart = [];
        this.renderCart();
    },

    async checkout() {
        if (this.cart.length === 0) return;

        const btn = document.getElementById('btn-checkout');
        btn.disabled = true;
        btn.textContent = '⏳ Memproses...';

        try {
            const data = {
                channel: 'Langsung',
                payment_method: this.selectedPayment,
                items: this.cart.map(item => ({
                    menu_name: item.menu_name,
                    category: item.category,
                    price: item.price,
                    quantity: item.quantity,
                    extras: item.extras
                }))
            };

            await API.post('/api/sales', data);
            showToast('✅ Transaksi berhasil!', 'success');
            this.clearCart();
            this.loadHistory();
        } catch (err) {
            showToast('❌ Gagal menyimpan transaksi', 'error');
        } finally {
            btn.textContent = '✅ BAYAR';
            btn.disabled = this.cart.length === 0;
        }
    },

    async submitShopeeFood() {
        const input = document.getElementById('shopee-total-input');
        const notesInput = document.getElementById('shopee-notes');
        const total = parseInt(input.value);

        if (!total || total <= 0) {
            showToast('Masukkan total ShopeeFood', 'error');
            return;
        }

        const btn = document.getElementById('btn-shopee-submit');
        btn.disabled = true;
        btn.textContent = '⏳ Memproses...';

        try {
            await API.post('/api/sales', {
                channel: 'ShopeeFood',
                shopee_total: total,
                notes: notesInput.value || null
            });

            showToast('✅ Penjualan ShopeeFood tersimpan!', 'success');
            input.value = '';
            notesInput.value = '';
            document.getElementById('shopee-calc').style.display = 'none';
            this.loadHistory();
        } catch (err) {
            showToast('❌ Gagal menyimpan', 'error');
        } finally {
            btn.textContent = '✅ SIMPAN';
            btn.disabled = true;
        }
    },

    async loadHistory() {
        try {
            const sales = await API.get('/api/sales/today');
            const container = document.getElementById('history-list');

            if (!sales || sales.length === 0) {
                container.innerHTML = '<div class="history-empty">Belum ada transaksi hari ini</div>';
                return;
            }

            container.innerHTML = sales.map(sale => {
                const isShopee = sale.channel === 'ShopeeFood';
                let itemsText = '';

                if (isShopee) {
                    itemsText = sale.notes || 'ShopeeFood';
                } else if (sale.items && sale.items.length > 0) {
                    itemsText = sale.items.map(i => `${i.quantity}× ${i.menu_name}`).join(', ');
                }

                return `
                    <div class="history-item">
                        <span class="history-badge ${isShopee ? 'badge-shopee' : 'badge-langsung'}">
                            ${sale.channel}
                        </span>
                        ${!isShopee && sale.payment_method ? `
                            <span class="history-badge ${sale.payment_method === 'QRIS' ? 'badge-qris' : 'badge-tunai'}">
                                ${sale.payment_method}
                            </span>
                        ` : ''}
                        <div class="history-info">
                            <div class="history-items-text">${itemsText}</div>
                        </div>
                        <div>
                            <div class="history-amount">${formatRupiah(sale.total)}</div>
                            ${isShopee ? `<div class="history-time text-danger shopee-cut-history">-${formatRupiah(sale.channel_cut)}</div>` : ''}
                            <div class="history-time">${formatTime(sale.created_at)}</div>
                        </div>
                        <button class="history-delete" onclick="POS.deleteSale(${sale.id})">🗑️</button>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    },

    async deleteSale(id) {
        if (!confirm('Hapus transaksi ini?')) return;
        try {
            await API.delete(`/api/sales/${id}`);
            showToast('Transaksi dihapus', 'success');
            this.loadHistory();
        } catch (err) {
            showToast('Gagal menghapus', 'error');
        }
    },

    bindEvents() {
        // Channel buttons
        document.querySelectorAll('.channel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedChannel = btn.dataset.channel;

                document.getElementById('pos-langsung').style.display =
                    this.selectedChannel === 'Langsung' ? 'block' : 'none';
                document.getElementById('pos-shopee').style.display =
                    this.selectedChannel === 'ShopeeFood' ? 'block' : 'none';
            });
        });

        // Payment buttons
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedPayment = btn.dataset.method;
            });
        });

        // Clear cart
        document.getElementById('btn-clear-cart').addEventListener('click', () => {
            if (this.cart.length > 0 && confirm('Kosongkan keranjang?')) {
                this.clearCart();
            }
        });

        // Checkout
        document.getElementById('btn-checkout').addEventListener('click', () => this.checkout());

        // ShopeeFood input
        const shopeeInput = document.getElementById('shopee-total-input');
        shopeeInput.addEventListener('input', () => {
            const val = parseInt(shopeeInput.value) || 0;
            const calcEl = document.getElementById('shopee-calc');
            const submitBtn = document.getElementById('btn-shopee-submit');

            if (val > 0) {
                const cut = Math.round(val * 0.25);
                const net = val - cut;
                document.getElementById('shopee-subtotal').textContent = formatRupiah(val);
                document.getElementById('shopee-cut').textContent = '-' + formatRupiah(cut);
                document.getElementById('shopee-net').textContent = formatRupiah(net);
                calcEl.style.display = 'block';
                submitBtn.disabled = false;
            } else {
                calcEl.style.display = 'none';
                submitBtn.disabled = true;
            }
        });

        // ShopeeFood submit
        document.getElementById('btn-shopee-submit').addEventListener('click', () => this.submitShopeeFood());

        // History toggle (accordion)
        const historyToggle = document.getElementById('history-toggle');
        const historyDropdown = document.getElementById('history-dropdown');
        const historyArrow = document.getElementById('history-toggle-arrow');
        if (historyToggle) {
            historyToggle.addEventListener('click', () => {
                historyDropdown.classList.toggle('open');
                historyArrow.classList.toggle('open');
            });
        }

        // Floating cart bar - open sheet
        const floatingToggle = document.getElementById('floating-cart-toggle');
        if (floatingToggle) {
            floatingToggle.addEventListener('click', () => this.openCartSheet());
        }

        // Floating cart bar - direct pay
        const floatingPay = document.getElementById('floating-cart-pay');
        if (floatingPay) {
            floatingPay.addEventListener('click', () => this.checkout());
        }

        // Bottom sheet overlay - close
        const sheetOverlay = document.getElementById('cart-sheet-overlay');
        if (sheetOverlay) {
            sheetOverlay.addEventListener('click', () => this.closeCartSheet());
        }

        // Bottom sheet handle - close on tap
        const sheetHandle = document.querySelector('.cart-sheet-handle');
        if (sheetHandle) {
            sheetHandle.addEventListener('click', () => this.closeCartSheet());
        }

        // Mobile checkout button in sheet
        const mobileCheckout = document.getElementById('btn-checkout-mobile');
        if (mobileCheckout) {
            mobileCheckout.addEventListener('click', () => {
                this.closeCartSheet();
                this.checkout();
            });
        }

        // Mobile clear cart in sheet
        const mobileClearCart = document.getElementById('btn-clear-cart-mobile');
        if (mobileClearCart) {
            mobileClearCart.addEventListener('click', () => {
                if (this.cart.length > 0 && confirm('Kosongkan keranjang?')) {
                    this.clearCart();
                    this.closeCartSheet();
                }
            });
        }
    },

    // === MOBILE UI METHODS ===

    initMobileUI() {
        // Initial state
        this.updateFloatingBar();
        
        // Listen for resize to update visibility
        window.addEventListener('resize', () => this.updateFloatingBar());
    },

    updateFloatingBar() {
        const bar = document.getElementById('floating-cart-bar');
        if (!bar) return;

        if (!this.isMobile()) {
            bar.style.display = 'none';
            return;
        }

        const totalQty = this.cart.reduce((sum, item) => sum + item.quantity, 0);

        if (totalQty === 0) {
            bar.style.display = 'none';
            return;
        }

        // Calculate grand total
        let grandTotal = 0;
        this.cart.forEach(item => {
            const extrasTotal = item.extras.reduce((sum, e) => sum + e.price, 0);
            grandTotal += (item.price + extrasTotal) * item.quantity;
        });

        bar.style.display = 'flex';
        document.getElementById('floating-cart-badge').textContent = totalQty;
        document.getElementById('floating-cart-total').textContent = formatRupiah(grandTotal);
    },

    openCartSheet() {
        const sheet = document.getElementById('cart-sheet');
        const overlay = document.getElementById('cart-sheet-overlay');
        if (sheet && overlay) {
            sheet.classList.add('open');
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    },

    closeCartSheet() {
        const sheet = document.getElementById('cart-sheet');
        const overlay = document.getElementById('cart-sheet-overlay');
        if (sheet && overlay) {
            sheet.classList.remove('open');
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    }
};
