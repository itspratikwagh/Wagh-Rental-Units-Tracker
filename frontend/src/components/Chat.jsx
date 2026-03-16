import { useState, useRef, useEffect } from 'react';
import {
  Typography, Box, TextField, Button, Paper, CircularProgress, Chip,
  Alert, Stack,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import config from '../config';

const API = config.apiUrl;

const SUGGESTED_QUESTIONS = [
  'Which tenants are behind on rent this month?',
  'What were my total expenses last quarter?',
  'Compare utility costs between my two properties',
  'What is my net profit this year?',
  'Add a $150 maintenance expense for Edmonton today',
  'Show me a summary of all payments this month',
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  const sendMessage = async (text) => {
    const userMessage = text || input.trim();
    if (!userMessage || loading) return;

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

        if (data.pendingAction) {
          setPendingAction(data.pendingAction);
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to connect to the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setLoading(true);
    const action = pendingAction;
    setPendingAction(null);

    try {
      const res = await fetch(`${API}/api/chat/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          conversationHistory,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, { role: 'system', content: `Failed: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'system', content: `Done: ${data.result?.message || 'Action completed'}` }]);
        if (data.response) {
          setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        }
        setConversationHistory(data.conversationHistory);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: 'Failed to execute action.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    setPendingAction(null);
    setMessages(prev => [...prev, { role: 'system', content: 'Action cancelled.' }]);
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
    setPendingAction(null);
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
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Ask anything about your properties, tenants, payments, or expenses.
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
              You can also ask me to add expenses, record payments, or update tenant info.
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
                justifyContent: msg.role === 'user' ? 'flex-end' : msg.role === 'system' ? 'center' : 'flex-start',
                mb: 1.5,
              }}
            >
              {msg.role === 'system' ? (
                <Alert
                  severity={msg.content.startsWith('Done:') ? 'success' : msg.content.startsWith('Failed:') ? 'error' : 'info'}
                  sx={{ maxWidth: '80%' }}
                >
                  {msg.content}
                </Alert>
              ) : (
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
              )}
            </Box>
          ))
        )}

        {/* Pending action confirmation */}
        {pendingAction && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1.5 }}>
            <Paper
              elevation={2}
              sx={{
                p: 2,
                maxWidth: '85%',
                border: '2px solid',
                borderColor: 'warning.main',
                borderRadius: 2,
                backgroundColor: 'warning.50',
              }}
            >
              <Typography variant="subtitle2" color="warning.dark" sx={{ mb: 1 }}>
                Confirm this action?
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                {pendingAction.description}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  Confirm
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<CancelIcon />}
                  onClick={handleReject}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </Stack>
            </Paper>
          </Box>
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
          placeholder="Ask about your rental data or tell me to add something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || !!pendingAction}
          size="small"
          multiline
          maxRows={3}
        />
        <Button
          variant="contained"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim() || !!pendingAction}
          sx={{ minWidth: 'auto', px: 2 }}
        >
          <SendIcon />
        </Button>
      </Box>
    </Box>
  );
}
