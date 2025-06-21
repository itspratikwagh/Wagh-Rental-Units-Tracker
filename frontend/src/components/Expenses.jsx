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

const EXPENSE_CATEGORIES = [
  'Mortgage',
  'Property Taxes',
  'Utility Bills',
  'Internet Bills',
  'Home Improvement',
  'Maintenance',
  'Insurance',
  'Other'
];

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [properties, setProperties] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [newExpense, setNewExpense] = useState({
    amount: '',
    date: '',
    category: '',
    description: '',
    propertyId: '',
  });

  useEffect(() => {
    fetchExpenses();
    fetchProperties();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await fetch('http://localhost:3005/api/expenses');
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching expenses:', errorData);
        setExpenses([]); // Set empty array on error
        return;
      }
      const data = await response.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setExpenses([]); // Set empty array on error
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch('http://localhost:3005/api/properties');
      const data = await response.json();
      setProperties(data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setNewExpense({
      amount: '',
      date: '',
      category: '',
      description: '',
      propertyId: '',
    });
  };

  const handleEditOpen = (expense) => {
    setSelectedExpense(expense);
    setNewExpense({
      amount: expense.amount,
      date: new Date(expense.date).toISOString().split('T')[0],
      category: expense.category,
      description: expense.description || '',
      propertyId: expense.propertyId,
    });
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setSelectedExpense(null);
    setNewExpense({
      amount: '',
      date: '',
      category: '',
      description: '',
      propertyId: '',
    });
  };

  const handleDeleteOpen = (expense) => {
    setSelectedExpense(expense);
    setDeleteOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteOpen(false);
    setSelectedExpense(null);
  };

  const handleChange = (e) => {
    setNewExpense({
      ...newExpense,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log('Submitting expense:', newExpense);
      const response = await fetch('http://localhost:3005/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newExpense),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        alert(errorData.error || 'Failed to create expense');
        return;
      }
      
      const data = await response.json();
      console.log('Expense created:', data);
      fetchExpenses();
      handleClose();
    } catch (error) {
      console.error('Error creating expense:', error);
      alert('Failed to create expense. Please try again.');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:3005/api/expenses/${selectedExpense.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newExpense),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        alert(errorData.error || 'Failed to update expense');
        return;
      }

      await response.json();
      fetchExpenses();
      handleEditClose();
    } catch (error) {
      console.error('Error updating expense:', error);
      alert('Failed to update expense. Please try again.');
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`http://localhost:3005/api/expenses/${selectedExpense.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        alert(errorData.error || 'Failed to delete expense');
        return;
      }

      fetchExpenses();
      handleDeleteClose();
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense. Please try again.');
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

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Property</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...expenses]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      {new Date(expense.date).toLocaleDateString('en-US', {
                        timeZone: 'UTC',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>{properties.find(p => p.id === expense.propertyId)?.name || 'Unknown'}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell align="right">${expense.amount}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleEditOpen(expense)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteOpen(expense)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>Add New Expense</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
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
                {EXPENSE_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
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
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Add Expense
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={editOpen} onClose={handleEditClose}>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleEdit} sx={{ mt: 2 }}>
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
                {EXPENSE_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
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
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEditClose}>Cancel</Button>
            <Button onClick={handleEdit} variant="contained" color="primary">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteOpen} onClose={handleDeleteClose}>
          <DialogTitle>Delete Expense</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this expense? This action cannot be undone.
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

export default Expenses; 