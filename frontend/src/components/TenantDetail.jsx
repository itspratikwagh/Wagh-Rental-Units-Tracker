import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Box, Button, Card, CardContent, Chip, IconButton, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Select,
  MenuItem, FormControl, InputLabel, Alert, CircularProgress, Tooltip, Grid,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import BadgeIcon from '@mui/icons-material/Badge';
import config from '../config';
import { formatDate, formatCurrency } from '../utils/formatters';

const API = config.apiUrl;

const KIND_META = {
  id: { label: 'ID', icon: <BadgeIcon fontSize="small" /> },
  lease: { label: 'Lease', icon: <DescriptionIcon fontSize="small" /> },
  other: { label: 'Other', icon: <DescriptionIcon fontSize="small" /> },
};

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState('lease');

  const fetchData = useCallback(async () => {
    try {
      const [tenantRes, docsRes] = await Promise.all([
        fetch(`${API}/api/tenants/${id}`),
        fetch(`${API}/api/tenants/${id}/documents`),
      ]);
      if (!tenantRes.ok) throw new Error('Tenant not found');
      setTenant(await tenantRes.json());
      setDocuments(docsRes.ok ? await docsRes.json() : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', uploadKind);
      // No Content-Type header — the browser sets the multipart boundary
      const res = await fetch(`${API}/api/tenants/${id}/documents`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setNotice({ severity: 'success', text: `Uploaded ${data.filename}` });
      fetchData();
    } catch (err) {
      setNotice({ severity: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  };

  // Downloads must go through fetch so the Authorization header is attached
  const handleDownload = async (doc) => {
    try {
      const res = await fetch(`${API}/api/documents/${doc.id}/download`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: doc.filename });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotice({ severity: 'error', text: err.message });
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/api/documents/${doc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setNotice({ severity: 'success', text: `Deleted ${doc.filename}` });
      fetchData();
    } catch (err) {
      setNotice({ severity: 'error', text: err.message });
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/tenants')}>Back to tenants</Button>
        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
      </Box>
    );
  }

  const daysToLeaseEnd = Math.floor((new Date(tenant.leaseEnd) - new Date()) / 86400000);
  const leaseChip = daysToLeaseEnd < 0
    ? { label: 'Lease ended', color: 'default' }
    : {
        label: `${daysToLeaseEnd} days until lease end`,
        color: daysToLeaseEnd < 30 ? 'error' : daysToLeaseEnd < 90 ? 'warning' : 'success',
      };
  const payments = [...(tenant.Payment || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/tenants')}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" sx={{ flex: 1 }}>{tenant.name}</Typography>
        {tenant.isArchived && <Chip label="Archived" color="default" size="small" />}
      </Box>

      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">Lease</Typography>
                <Chip label={leaseChip.label} color={leaseChip.color} size="small" />
              </Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Property: {tenant.Property?.name} — {tenant.Property?.address}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Rent: {formatCurrency(tenant.rentAmount)}/month
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Term: {formatDate(tenant.leaseStart)} → {formatDate(tenant.leaseEnd)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Email: {tenant.email || '—'}</Typography>
              <Typography variant="body2">Phone: {tenant.phone || '—'}</Typography>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Documents</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 110 }}>
                  <InputLabel>Type</InputLabel>
                  <Select value={uploadKind} label="Type" onChange={(e) => setUploadKind(e.target.value)}>
                    <MenuItem value="id">ID</MenuItem>
                    <MenuItem value="lease">Lease</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={uploading ? <CircularProgress size={16} /> : <UploadFileIcon />}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                  <input type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" onChange={handleUpload} />
                </Button>
                <Typography variant="caption" color="text.secondary">PDF or photo, max 10MB</Typography>
              </Box>
              {documents.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No documents yet. Upload the signed lease and a copy of their ID.
                </Typography>
              ) : (
                documents.map((doc) => (
                  <Box key={doc.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Chip icon={KIND_META[doc.kind]?.icon} label={KIND_META[doc.kind]?.label || doc.kind} size="small" variant="outlined" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{doc.filename}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatSize(doc.sizeBytes)} · {formatDate(doc.uploadedAt)}
                      </Typography>
                    </Box>
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleDownload(doc)}><DownloadIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(doc)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Payment history</Typography>
              {payments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No payments recorded yet.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatDate(p.date)}</TableCell>
                          <TableCell align="right">{formatCurrency(p.amount)}</TableCell>
                          <TableCell>{p.paymentMethod}</TableCell>
                          <TableCell>
                            <Chip label={p.status} size="small" color={p.status === 'completed' ? 'success' : 'warning'} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
