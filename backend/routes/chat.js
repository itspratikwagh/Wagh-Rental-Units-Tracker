const express = require('express');
const router = express.Router();
const { chat, confirmAction } = require('../services/chat');

module.exports = function (prisma) {
  // Send a chat message
  router.post('/', async (req, res) => {
    try {
      const { message, conversationHistory } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Anthropic API key not configured' });
      }

      const result = await chat(prisma, message, conversationHistory || []);
      res.json(result);
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: 'Failed to get response from AI' });
    }
  });

  // Confirm a pending write action
  router.post('/confirm', async (req, res) => {
    try {
      const { action, conversationHistory } = req.body;

      if (!action || !action.toolName) {
        return res.status(400).json({ error: 'No action to confirm' });
      }

      const result = await confirmAction(prisma, action, conversationHistory || []);
      res.json(result);
    } catch (error) {
      console.error('Confirm action error:', error);
      res.status(500).json({ error: error.message || 'Failed to execute action' });
    }
  });

  return router;
};
