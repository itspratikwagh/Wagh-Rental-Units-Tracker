import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
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
  Menu,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CategoryIcon from '@mui/icons-material/Category';
import HomeIcon from '@mui/icons-material/Home';
import DownloadIcon from '@mui/icons-material/Download';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DateRangeIcon from '@mui/icons-material/DateRange';
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
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
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

  const handleDateRangeChange = (event, newDateRange) => {
    if (newDateRange !== null) {
      setDateRange(newDateRange);
    }
  };

  const getDateRangeValues = () => {
    const now = new Date();
    let startDate, endDate;

    switch (dateRange) {
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      case 'custom':
        startDate = customStartDate ? new Date(customStartDate) : null;
        endDate = customEndDate ? new Date(customEndDate) : null;
        break;
      default:
        return { startDate: null, endDate: null };
    }

    return { startDate, endDate };
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

    // Filter by date range
    const { startDate, endDate } = getDateRangeValues();
    if (startDate && endDate) {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getExpenseStatistics = () => {
    const filteredExpenses = getFilteredExpenses();
    const allExpenses = [...expenses];
    
    const now = new Date();
    const thisMonth = allExpenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
    });
    
    const thisYear = allExpenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getFullYear() === now.getFullYear();
    });
    
    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const thisMonthAmount = thisMonth.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const thisYearAmount = thisYear.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    
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
      thisMonthAmount,
      thisYearAmount,
      thisMonthCount: thisMonth.length,
      thisYearCount: thisYear.length,
      categoryBreakdown,
      propertyBreakdown
    };
  };

  const exportToCSV = () => {
    const filteredExpenses = getFilteredExpenses();
    const stats = getExpenseStatistics();
    
    let csvContent = "Wagh Rental Properties - Expense Report\n";
    csvContent += `Generated on: ${new Date().toLocaleDateString()}\n`;
    csvContent += `Total Expenses: $${stats.totalAmount.toFixed(2)} (${stats.totalCount} items)\n`;
    csvContent += `This Month: $${stats.thisMonthAmount.toFixed(2)} (${stats.thisMonthCount} items)\n`;
    csvContent += `This Year: $${stats.thisYearAmount.toFixed(2)} (${stats.thisYearCount} items)\n\n`;
    
    csvContent += "Date,Property,Category,Amount,Description\n";
    
    filteredExpenses.forEach(expense => {
      const propertyName = properties.find(p => p.id === expense.propertyId)?.name || 'Unknown';
      const date = new Date(expense.date).toLocaleDateString();
      const description = (expense.description || '').replace(/"/g, '""'); // Escape quotes
      csvContent += `"${date}","${propertyName}","${expense.category}","$${expense.amount}","${description}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expense-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setExportMenuAnchor(null);
  };
  
  const exportToPDF = () => {
    const filteredExpenses = getFilteredExpenses();
    const stats = getExpenseStatistics();
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('Wagh Rental Properties', 20, 20);
    doc.setFontSize(14);
    doc.text('Expense Report', 20, 30);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 40);
    
    // Summary Stats
    doc.setFontSize(12);
    doc.text('Summary:', 20, 55);
    doc.setFontSize(10);
    doc.text(`Total Expenses: $${stats.totalAmount.toFixed(2)} (${stats.totalCount} items)`, 20, 65);
    doc.text(`This Month: $${stats.thisMonthAmount.toFixed(2)} (${stats.thisMonthCount} items)`, 20, 75);
    doc.text(`This Year: $${stats.thisYearAmount.toFixed(2)} (${stats.thisYearCount} items)`, 20, 85);
    
    // Table
    const tableData = filteredExpenses.map(expense => [
      new Date(expense.date).toLocaleDateString(),
      properties.find(p => p.id === expense.propertyId)?.name || 'Unknown',
      expense.category,
      `$${expense.amount}`,
      (expense.description || '').substring(0, 50) + (expense.description?.length > 50 ? '...' : '')
    ]);
    
    doc.autoTable({
      head: [['Date', 'Property', 'Category', 'Amount', 'Description']],
      body: tableData,
      startY: 95,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    
    doc.save(`expense-report-${new Date().toISOString().split('T')[0]}.pdf`);
    setExportMenuAnchor(null);
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
          <Stack direction="row" spacing={2}>
            <Button 
              variant="outlined" 
              startIcon={<DownloadIcon />} 
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            >
              Export
            </Button>
            <Button variant="contained" color="primary" onClick={handleOpen}>
              Add Expense
            </Button>
          </Stack>
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
                      <CalendarTodayIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="div">
                        This Month
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary">
                      ${stats.thisMonthAmount.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stats.thisMonthCount} expenses
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DateRangeIcon color="secondary" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="div">
                        This Year
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="secondary">
                      ${stats.thisYearAmount.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stats.thisYearCount} expenses
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TrendingUpIcon color="success" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="div">
                        Current View
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="success">
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
                      <CategoryIcon color="info" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="div">
                        Top Category
                      </Typography>
                    </Box>
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

        {/* Date Range Filters */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <DateRangeIcon sx={{ mr: 1 }} />
            Time Range
          </Typography>
          <ToggleButtonGroup
            value={dateRange}
            exclusive
            onChange={handleDateRangeChange}
            aria-label="date range"
            sx={{ mb: 2 }}
          >
            <ToggleButton value="all" aria-label="all time">
              All Time
            </ToggleButton>
            <ToggleButton value="thisMonth" aria-label="this month">
              This Month
            </ToggleButton>
            <ToggleButton value="thisYear" aria-label="this year">
              This Year
            </ToggleButton>
            <ToggleButton value="lastMonth" aria-label="last month">
              Last Month
            </ToggleButton>
            <ToggleButton value="lastYear" aria-label="last year">
              Last Year
            </ToggleButton>
            <ToggleButton value="custom" aria-label="custom range">
              Custom
            </ToggleButton>
          </ToggleButtonGroup>
          
          {dateRange === 'custom' && (
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <TextField
                type="date"
                label="Start Date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="date"
                label="End Date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}
        </Box>

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

        {/* Export Menu */}
        <Menu
          anchorEl={exportMenuAnchor}
          open={Boolean(exportMenuAnchor)}
          onClose={() => setExportMenuAnchor(null)}
        >
          <MenuItem onClick={exportToCSV}>Export as CSV</MenuItem>
          <MenuItem onClick={exportToPDF}>Export as PDF</MenuItem>
        </Menu>
      </Box>
    </Container>
  );
};

export default Expenses; 