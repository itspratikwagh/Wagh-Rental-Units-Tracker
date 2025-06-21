import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [newPayment, setNewPayment] = useState({
    tenantId: '',
    amount: '',
    date: '',
    notes: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPayments();
    fetchTenants();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch('http://localhost:3005/api/payments');
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await fetch('http://localhost:3005/api/tenants');
      const data = await response.json();
      setTenants(data);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setNewPayment({
      tenantId: '',
      amount: '',
      date: '',
      notes: '',
    });
    setError(null);
  };

  const handleEditOpen = (payment) => {
    setSelectedPayment(payment);
    setNewPayment({
      tenantId: payment.tenantId,
      amount: payment.amount,
      date: new Date(payment.date).toISOString().split('T')[0],
      notes: payment.notes || '',
    });
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setSelectedPayment(null);
    setNewPayment({
      tenantId: '',
      amount: '',
      date: '',
      notes: '',
    });
    setError(null);
  };

  const handleDeleteOpen = (payment) => {
    setSelectedPayment(payment);
    setDeleteOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteOpen(false);
    setSelectedPayment(null);
  };

  const handleChange = (e) => {
    setNewPayment({
      ...newPayment,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const paymentData = {
        ...newPayment,
        paymentMethod: 'bank_transfer' // Always set to bank transfer
      };

      const response = await fetch('http://localhost:3005/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment');
      }

      fetchPayments();
      handleClose();
    } catch (error) {
      console.error('Error creating payment:', error);
      setError(error.message);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const paymentData = {
        ...newPayment,
        paymentMethod: 'bank_transfer' // Always set to bank transfer
      };

      const response = await fetch(`http://localhost:3005/api/payments/${selectedPayment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update payment');
      }

      fetchPayments();
      handleEditClose();
    } catch (error) {
      console.error('Error updating payment:', error);
      setError(error.message);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`http://localhost:3005/api/payments/${selectedPayment.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete payment');
      }

      fetchPayments();
      handleDeleteClose();
    } catch (error) {
      console.error('Error deleting payment:', error);
      setError(error.message);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Payments
          </Typography>
          <Button variant="contained" color="primary" onClick={handleOpen}>
            Add Payment
          </Button>
        </Box>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...payments]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.date).toLocaleDateString('en-US', {
                        timeZone: 'UTC',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>{payment.tenant?.name}</TableCell>
                    <TableCell align="right">${payment.amount}</TableCell>
                    <TableCell>{payment.notes}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleEditOpen(payment)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteOpen(payment)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Add Payment Dialog */}
        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>Add New Payment</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                select
                label="Tenant"
                name="tenantId"
                value={newPayment.tenantId}
                onChange={handleChange}
                margin="normal"
                required
              >
                {tenants.map((tenant) => (
                  <MenuItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Amount"
                name="amount"
                type="number"
                value={newPayment.amount}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Date"
                name="date"
                type="date"
                value={newPayment.date}
                onChange={handleChange}
                margin="normal"
                required
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <TextField
                fullWidth
                label="Notes"
                name="notes"
                value={newPayment.notes}
                onChange={handleChange}
                margin="normal"
                multiline
                rows={3}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Add Payment
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Payment Dialog */}
        <Dialog open={editOpen} onClose={handleEditClose}>
          <DialogTitle>Edit Payment</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleEdit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                select
                label="Tenant"
                name="tenantId"
                value={newPayment.tenantId}
                onChange={handleChange}
                margin="normal"
                required
              >
                {tenants.map((tenant) => (
                  <MenuItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Amount"
                name="amount"
                type="number"
                value={newPayment.amount}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Date"
                name="date"
                type="date"
                value={newPayment.date}
                onChange={handleChange}
                margin="normal"
                required
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <TextField
                fullWidth
                label="Notes"
                name="notes"
                value={newPayment.notes}
                onChange={handleChange}
                margin="normal"
                multiline
                rows={3}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEditClose}>Cancel</Button>
            <Button onClick={handleEdit} variant="contained" color="primary">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteOpen} onClose={handleDeleteClose}>
          <DialogTitle>Delete Payment</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this payment? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteClose}>Cancel</Button>
            <Button onClick={handleDelete} variant="contained" color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Payments; 