const express = require('express');
const router = express.Router();
const groqChat = require('../groq');

// POST /api/chat - Send message to AI
router.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }
        const reply = await groqChat.chat(message);
        res.json({ success: true, data: { reply } });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/chat - Reset conversation
router.delete('/', (req, res) => {
    groqChat.resetConversation();
    res.json({ success: true, message: 'Conversation reset' });
});

module.exports = router;
