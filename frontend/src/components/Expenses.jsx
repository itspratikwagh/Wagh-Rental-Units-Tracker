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

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [properties, setProperties] = useState([]);
  const [open, setOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    propertyId: '',
    amount: '',
    date: '',
    category: '',
    description: '',
  });

  useEffect(() => {
    fetchExpenses();
    fetchProperties();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/expenses');
      const data = await response.json();
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/properties');
      const data = await response.json();
      setProperties(data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleChange = (e) => {
    setNewExpense({
      ...newExpense,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3003/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newExpense),
      });
      if (response.ok) {
        fetchExpenses();
        handleClose();
        setNewExpense({
          propertyId: '',
          amount: '',
          date: '',
          category: '',
          description: '',
        });
      }
    } catch (error) {
      console.error('Error creating expense:', error);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Expenses
          </Typography>
          <Button variant="contained" color="primary" onClick={handleOpen}>
            Add Expense
          </Button>
        </Box>

        <Grid container spacing={3}>
          {expenses.map((expense) => (
            <Grid item xs={12} sm={6} md={4} key={expense.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    ${expense.amount}
                  </Typography>
                  <Typography color="textSecondary" gutterBottom>
                    Property: {expense.property?.name}
                  </Typography>
                  <Typography variant="body2">
                    Date: {new Date(expense.date).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2">
                    Category: {expense.category}
                  </Typography>
                  {expense.description && (
                    <Typography variant="body2">
                      Description: {expense.description}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>Add New Expense</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                select
                label="Property"
                name="propertyId"
                value={newExpense.propertyId}
                onChange={handleChange}
                margin="normal"
                required
              >
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>
                    {property.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Amount"
                name="amount"
                type="number"
                value={newExpense.amount}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Date"
                name="date"
                type="date"
                value={newExpense.date}
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
                label="Category"
                name="category"
                value={newExpense.category}
                onChange={handleChange}
                margin="normal"
                required
              >
                <MenuItem value="maintenance">Maintenance</MenuItem>
                <MenuItem value="repairs">Repairs</MenuItem>
                <MenuItem value="utilities">Utilities</MenuItem>
                <MenuItem value="insurance">Insurance</MenuItem>
                <MenuItem value="taxes">Taxes</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={newExpense.description}
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
              Add Expense
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Expenses; 