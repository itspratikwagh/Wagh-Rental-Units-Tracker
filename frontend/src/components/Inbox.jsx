import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Box, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  Alert, CircularProgress, Tabs, Tab, Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import SyncIcon from '@mui/icons-material/Sync';
import LinkIcon from '@mui/icons-material/Link';
import config from '../config';

const API = config.apiUrl;

export default function Inbox() {
  const [pending, setPending] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [gmailStatus, setGmailStatus] = useState({ connected: false, lastSyncAt: null });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState('pending');
  const [editDialog, setEditDialog] = useState({ open: false, item: null });
  const [editForm, setEditForm] = useState({});
  const [scanResult, setScanResult] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [pendingRes, tenantsRes, propsRes, statusRes] = await Promise.all([
        fetch(`${API}/api/gmail/pending?status=${tab}`),
        fetch(`${API}/api/tenants`),
        fetch(`${API}/api/properties`),
        fetch(`${API}/api/gmail/status`),
      ]);
      setPending(await pendingRes.json());
      setTenants(await tenantsRes.json());
      setProperties(await propsRes.json());
      setGmailStatus(await statusRes.json());
    } catch (err) {
      console.error('Failed to fetch inbox data:', err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(`${API}/api/gmail/scan`, { method: 'POST' });
      const data = await res.json();
      setScanResult(data);
      fetchData();
    } catch (err) {
      setScanResult({ error: 'Scan failed' });
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (id, overrides = {}) => {
    try {
      await fetch(`${API}/api/gmail/pending/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides),
      });
      fetchData();
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleReject = async (id) => {
    try {
      await fetch(`${API}/api/gmail/pending/${id}/reject`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  const handleBulkApprove = async () => {
    try {
      const res = await fetch(`${API}/api/gmail/pending/approve-all`, { method: 'POST' });
      const data = await res.json();
      setScanResult({ message: data.message });
      fetchData();
    } catch (err) {
      console.error('Bulk approve failed:', err);
    }
  };

  const openEdit = (item) => {
    setEditForm({
      amount: item.amount,
      tenantId: item.tenantId || '',
      propertyId: item.propertyId || '',
      category: item.category || 'Utility Bills',
      description: item.description || '',
      notes: '',
    });
    setEditDialog({ open: true, item });
  };

  const handleEditApprove = () => {
    handleApprove(editDialog.item.id, editForm);
    setEditDialog({ open: false, item: null });
  };

  const confidenceColor = (c) => {
    if (c === 'high') return 'success';
    if (c === 'medium') return 'warning';
    return 'error';
  };

  const getTenantName = (id) => tenants.find(t => t.id === id)?.name || 'Unknown';
  const getPropertyName = (id) => properties.find(p => p.id === id)?.name || 'Unknown';

  const highConfidenceCount = pending.filter(p => p.status === 'pending' && p.matchConfidence === 'high').length;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Inbox</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {gmailStatus.lastSyncAt && (
            <Typography variant="caption" color="text.secondary">
              Last scan: {new Date(gmailStatus.lastSyncAt).toLocaleString()}
            </Typography>
          )}
          {gmailStatus.connected ? (
            <Button
              variant="contained"
              startIcon={scanning ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleScan}
              disabled={scanning}
            >
              {scanning ? 'Scanning...' : 'Scan Gmail'}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<LinkIcon />}
              href={`${API}/api/gmail/auth`}
            >
              Connect Gmail
            </Button>
          )}
        </Box>
      </Box>

      {scanResult && (
        <Alert severity={scanResult.error ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setScanResult(null)}>
          {scanResult.error || scanResult.message}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Pending" value="pending" />
          <Tab label="Approved" value="approved" />
          <Tab label="Rejected" value="rejected" />
        </Tabs>
        {tab === 'pending' && highConfidenceCount > 0 && (
          <Button variant="outlined" color="success" onClick={handleBulkApprove}>
            Approve All High-Confidence ({highConfidenceCount})
          </Button>
        )}
      </Box>

      {pending.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          {tab === 'pending' ? 'No pending transactions. Click "Scan Gmail" to check for new ones.' : `No ${tab} transactions.`}
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Matched To</TableCell>
                <TableCell>Confidence</TableCell>
                {tab === 'pending' && <TableCell align="center">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {pending.map((item) => (
                <TableRow
                  key={item.id}
                  sx={{
                    backgroundColor:
                      item.matchConfidence === 'none' && item.status === 'pending'
                        ? '#fff3e0'
                        : undefined,
                  }}
                >
                  <TableCell>
                    <Chip
                      label={item.type === 'payment' ? 'Payment' : 'Expense'}
                      color={item.type === 'payment' ? 'primary' : 'secondary'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Tooltip title={item.rawEmailSnippet || ''}>
                      <span>{item.senderName || item.source}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    {item.amount > 0 ? `$${item.amount.toFixed(2)}` : <Chip label="No amount" size="small" color="error" />}
                  </TableCell>
                  <TableCell>
                    {item.type === 'payment'
                      ? (item.tenantId ? getTenantName(item.tenantId) : <em>Unmatched</em>)
                      : (item.propertyId ? getPropertyName(item.propertyId) : <em>Unmatched</em>)
                    }
                  </TableCell>
                  <TableCell>
                    <Chip label={item.matchConfidence} color={confidenceColor(item.matchConfidence)} size="small" />
                  </TableCell>
                  {tab === 'pending' && (
                    <TableCell align="center">
                      <Tooltip title="Edit & Approve">
                        <IconButton size="small" onClick={() => openEdit(item)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Quick Approve">
                        <span>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleApprove(item.id)}
                            disabled={
                              (item.type === 'payment' && !item.tenantId) ||
                              (item.type === 'expense' && !item.propertyId) ||
                              item.amount <= 0
                            }
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Reject">
                        <IconButton size="small" color="error" onClick={() => handleReject(item.id)}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, item: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Review & Approve</DialogTitle>
        <DialogContent>
          {editDialog.item && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {editDialog.item.rawEmailSnippet && (
                <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
                  {editDialog.item.rawEmailSnippet}
                </Alert>
              )}
              <TextField
                label="Amount"
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                fullWidth
              />
              {editDialog.item.type === 'payment' ? (
                <FormControl fullWidth>
                  <InputLabel>Tenant</InputLabel>
                  <Select
                    value={editForm.tenantId}
                    label="Tenant"
                    onChange={(e) => setEditForm({ ...editForm, tenantId: e.target.value })}
                  >
                    {tenants.map(t => (
                      <MenuItem key={t.id} value={t.id}>{t.name} - {t.Property?.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <>
                  <FormControl fullWidth>
                    <InputLabel>Property</InputLabel>
                    <Select
                      value={editForm.propertyId}
                      label="Property"
                      onChange={(e) => setEditForm({ ...editForm, propertyId: e.target.value })}
                    >
                      {properties.map(p => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={editForm.category}
                      label="Category"
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    >
                      {['Mortgage', 'Property Taxes', 'Utility Bills', 'Internet Bills', 'Home Improvement', 'Maintenance', 'Insurance', 'Other'].map(c => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    fullWidth
                  />
                </>
              )}
              <TextField
                label="Notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, item: null })}>Cancel</Button>
          <Button onClick={handleEditApprove} variant="contained" color="success">Approve</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
