import { useState, useRef, useEffect } from 'react';
import {
  Typography, Box, TextField, Button, Paper, CircularProgress, Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import config from '../config';

const API = config.apiUrl;

const SUGGESTED_QUESTIONS = [
  'Which tenants are behind on rent this month?',
  'What were my total expenses last quarter?',
  'Compare utility costs between my two properties',
  'What is my net profit this year?',
  'Show me a summary of all payments this month',
  'Which expense category costs me the most?',
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const userMessage = text || input.trim();
    if (!userMessage) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        setConversationHistory(data.conversationHistory);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to connect to the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setMessages([]);
    setConversationHistory([]);
    setInput('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 400 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Chat with Your Data</Typography>
        {messages.length > 0 && (
          <Button size="small" startIcon={<RestartAltIcon />} onClick={resetChat}>
            New Conversation
          </Button>
        )}
      </Box>

      {/* Messages area */}
      <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
        {messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Ask anything about your properties, tenants, payments, or expenses.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <Chip
                  key={i}
                  label={q}
                  onClick={() => sendMessage(q)}
                  variant="outlined"
                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                />
              ))}
            </Box>
          </Box>
        ) : (
          messages.map((msg, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                mb: 1.5,
              }}
            >
              <Paper
                elevation={1}
                sx={{
                  p: 1.5,
                  maxWidth: '80%',
                  backgroundColor: msg.role === 'user' ? 'primary.main' : 'grey.100',
                  color: msg.role === 'user' ? 'white' : 'text.primary',
                  borderRadius: 2,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                >
                  {msg.content}
                </Typography>
              </Paper>
            </Box>
          ))
        )}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1.5 }}>
            <Paper elevation={1} sx={{ p: 1.5, backgroundColor: 'grey.100', borderRadius: 2 }}>
              <CircularProgress size={20} />
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input area */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          placeholder="Ask about your rental data..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          size="small"
          multiline
          maxRows={3}
        />
        <Button
          variant="contained"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          sx={{ minWidth: 'auto', px: 2 }}
        >
          <SendIcon />
        </Button>
      </Box>
    </Box>
  );
}
