/* ==========================================================================
   RAKSHA BLOCK — RAKSHA AI / LLAMA CHAT REST API
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { answerQuery } = require('../aiService');

// POST /api/ai/chat and /api/ai/query
router.post(['/chat', '/query'], async (req, res) => {
    try {
        const message = req.body.message || req.body.query;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message text is required.' });
        }

        const response = await answerQuery(message.trim());
        res.json({
            ...response,
            reply: response.answer
        });
    } catch (err) {
        console.error('AI Service Error:', err);
        res.status(500).json({
            error: 'AI service temporarily unavailable.',
            disclaimer: 'AI-generated assistance. Verify recommendations and follow authorized railway operational procedures.'
        });
    }
});

module.exports = router;
