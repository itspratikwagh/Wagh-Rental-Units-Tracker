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
  FormControl,
  InputLabel,
  Select,
  Grid,
  Alert,
  Chip,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CategoryIcon from '@mui/icons-material/Category';
import HomeIcon from '@mui/icons-material/Home';
import config from '../config';

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
  const [error, setError] = useState(null);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
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
      const response = await fetch(`${config.apiUrl}/api/expenses`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch expenses');
      }
      const data = await response.json();
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setError(error.message);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/properties`);
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

  const handlePropertyFilterChange = (event) => {
    setPropertyFilter(event.target.value);
  };

  const handleCategoryFilterChange = (event) => {
    setCategoryFilter(event.target.value);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const getFilteredExpenses = () => {
    let filtered = [...expenses];

    // Filter by property
    if (propertyFilter !== 'all') {
      filtered = filtered.filter(expense => expense.propertyId === propertyFilter);
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(expense => expense.category === categoryFilter);
    }

    // Filter by search term (description)
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(expense => 
        expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getExpenseStatistics = () => {
    const filteredExpenses = getFilteredExpenses();
    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    
    // Category breakdown
    const categoryBreakdown = {};
    filteredExpenses.forEach(expense => {
      categoryBreakdown[expense.category] = (categoryBreakdown[expense.category] || 0) + parseFloat(expense.amount);
    });

    // Property breakdown
    const propertyBreakdown = {};
    filteredExpenses.forEach(expense => {
      const propertyName = properties.find(p => p.id === expense.propertyId)?.name || 'Unknown';
      propertyBreakdown[propertyName] = (propertyBreakdown[propertyName] || 0) + parseFloat(expense.amount);
    });

    return {
      totalAmount,
      totalCount: filteredExpenses.length,
      categoryBreakdown,
      propertyBreakdown
    };
  };

  const handleChange = (e) => {
    setNewExpense({
      ...newExpense,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      console.log('Submitting expense:', newExpense);
      const response = await fetch(`${config.apiUrl}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newExpense),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create expense');
      }

      fetchExpenses();
      handleClose();
    } catch (error) {
      console.error('Error creating expense:', error);
      setError(error.message);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch(`${config.apiUrl}/api/expenses/${selectedExpense.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newExpense),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update expense');
      }

      fetchExpenses();
      handleEditClose();
    } catch (error) {
      console.error('Error updating expense:', error);
      setError(error.message);
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      const response = await fetch(`${config.apiUrl}/api/expenses/${selectedExpense.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete expense');
      }

      fetchExpenses();
      handleDeleteClose();
    } catch (error) {
      console.error('Error deleting expense:', error);
      setError(error.message);
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

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Statistics Cards */}
        {(() => {
          const stats = getExpenseStatistics();
          return (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="div">
                        Total Expenses
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary">
                      ${stats.totalAmount.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stats.totalCount} expenses
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CategoryIcon color="secondary" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="div">
                        Categories
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="secondary">
                      {Object.keys(stats.categoryBreakdown).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active categories
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <HomeIcon color="success" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="div">
                        Properties
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="success">
                      {Object.keys(stats.propertyBreakdown).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      With expenses
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" component="div">
                      Top Category
                    </Typography>
                    {(() => {
                      const topCategory = Object.entries(stats.categoryBreakdown)
                        .sort(([,a], [,b]) => b - a)[0];
                      return topCategory ? (
                        <>
                          <Typography variant="h4" color="info">
                            {topCategory[0]}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ${topCategory[1].toFixed(2)}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No expenses
                        </Typography>
                      );
                    })()}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          );
        })()}

        {/* Filters */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <FilterListIcon color="action" />
            <Typography variant="h6">Filters</Typography>
          </Stack>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Property</InputLabel>
                <Select
                  value={propertyFilter}
                  label="Property"
                  onChange={handlePropertyFilterChange}
                >
                  <MenuItem value="all">All Properties</MenuItem>
                  {properties.map((property) => (
                    <MenuItem key={property.id} value={property.id}>
                      {property.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Category"
                  onChange={handleCategoryFilterChange}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Search Description"
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Showing {getFilteredExpenses().length} of {expenses.length} expenses
              </Typography>
            </Grid>
          </Grid>
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
              {getFilteredExpenses().map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    {new Date(expense.date).toLocaleDateString('en-US', {
                      timeZone: 'UTC',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>{properties.find(p => p.id === expense.propertyId)?.name || 'Unknown Property'}</TableCell>
                  <TableCell>
                    <Chip
                      label={expense.category}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
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
                required
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
                required
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