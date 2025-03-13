import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
  Card,
  CardContent,
  MenuItem,
} from '@mui/material';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [open, setOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    tenantId: '',
    amount: '',
    date: '',
    paymentMethod: '',
    notes: '',
  });

  useEffect(() => {
    fetchPayments();
    fetchTenants();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/payments');
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/tenants');
      const data = await response.json();
      setTenants(data);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleChange = (e) => {
    setNewPayment({
      ...newPayment,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3003/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPayment),
      });
      if (response.ok) {
        fetchPayments();
        handleClose();
        setNewPayment({
          tenantId: '',
          amount: '',
          date: '',
          paymentMethod: '',
          notes: '',
        });
      }
    } catch (error) {
      console.error('Error creating payment:', error);
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

        <Grid container spacing={3}>
          {payments.map((payment) => (
            <Grid item xs={12} sm={6} md={4} key={payment.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    ${payment.amount}
                  </Typography>
                  <Typography color="textSecondary" gutterBottom>
                    Tenant: {payment.tenant?.name}
                  </Typography>
                  <Typography variant="body2">
                    Date: {new Date(payment.date).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2">
                    Method: {payment.paymentMethod}
                  </Typography>
                  {payment.notes && (
                    <Typography variant="body2">
                      Notes: {payment.notes}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

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
                select
                label="Payment Method"
                name="paymentMethod"
                value={newPayment.paymentMethod}
                onChange={handleChange}
                margin="normal"
                required
              >
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="check">Check</MenuItem>
                <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                <MenuItem value="credit_card">Credit Card</MenuItem>
              </TextField>
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
      </Box>
    </Container>
  );
};

export default Payments; 