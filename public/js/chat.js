// Chat Module
const Chat = {
    isLoading: false,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('btn-send');
        const resetBtn = document.getElementById('btn-reset-chat');

        // Send on click
        sendBtn.addEventListener('click', () => this.send());

        // Send on Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.send();
            }
        });

        // Reset conversation
        resetBtn.addEventListener('click', () => {
            if (confirm('Reset percakapan?')) {
                this.reset();
            }
        });
    },

    async send() {
        if (this.isLoading) return;

        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message) return;

        // Add user bubble
        this.addBubble(message, 'user');
        input.value = '';

        // Show typing indicator
        this.isLoading = true;
        const typingEl = this.addTypingIndicator();

        try {
            const data = await API.post('/api/chat', { message });
            // Remove typing indicator
            typingEl.remove();
            // Add bot response
            this.addBubble(data.reply, 'bot');
        } catch (err) {
            typingEl.remove();
            this.addBubble('⚠️ Maaf, ada gangguan. Coba lagi ya.', 'bot');
        } finally {
            this.isLoading = false;
            input.focus();
        }
    },

    addBubble(text, type) {
        const container = document.getElementById('chat-messages');
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${type}`;
        bubble.innerHTML = `<div class="bubble-content">${this.escapeHtml(text)}</div>`;
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
        return bubble;
    },

    addTypingIndicator() {
        const container = document.getElementById('chat-messages');
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble bot typing';
        bubble.innerHTML = `
            <div class="bubble-content">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
        return bubble;
    },

    async reset() {
        try {
            await API.delete('/api/chat');
            const container = document.getElementById('chat-messages');
            container.innerHTML = `
                <div class="chat-bubble bot">
                    <div class="bubble-content">
                        Halo Boss! 👋 Saya Asisten Malika. Mau catat pengeluaran atau tanya data bisnis hari ini?
                    </div>
                </div>
            `;
            showToast('Percakapan direset', 'success');
        } catch (err) {
            showToast('Gagal mereset', 'error');
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }
};
