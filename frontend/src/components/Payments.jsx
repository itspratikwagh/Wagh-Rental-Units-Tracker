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
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import config from '../config';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
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
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMissingPayments, setShowMissingPayments] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    fetchPayments();
    fetchTenants();
    fetchProperties();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/payments`);
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      // Make two separate calls to work around backend API issue
      const [currentResponse, archivedResponse] = await Promise.all([
        fetch(`${config.apiUrl}/api/tenants`),
        fetch(`${config.apiUrl}/api/tenants?includeArchived=true`)
      ]);
      
      if (!currentResponse.ok || !archivedResponse.ok) {
        throw new Error('Failed to fetch tenants');
      }
      
      const currentTenants = await currentResponse.json();
      const archivedTenants = await archivedResponse.json();
      
      // Combine and deduplicate tenants
      const allTenants = [...currentTenants];
      
      // Add archived tenants that aren't already in the current list
      archivedTenants.forEach(archivedTenant => {
        if (!allTenants.find(tenant => tenant.id === archivedTenant.id)) {
          allTenants.push(archivedTenant);
        }
      });
      
      setTenants(allTenants);
    } catch (error) {
      console.error('Error fetching tenants:', error);
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

  const handlePropertyChange = (event) => {
    setSelectedProperty(event.target.value);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleMissingPaymentsToggle = () => {
    setShowMissingPayments(!showMissingPayments);
    if (!showMissingPayments) {
      setSelectedMonth(new Date().toISOString().slice(0, 7)); // Current month as default
    }
  };

  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };

  const getFilteredPayments = () => {
    let filtered = [...payments];

    // Filter by property
    if (selectedProperty !== 'all') {
      filtered = filtered.filter(payment => {
        const tenant = tenants.find(t => t.id === payment.tenantId);
        return tenant && tenant.propertyId === selectedProperty;
      });
    }

    // Filter by search term (tenant name)
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(payment => {
        const tenant = tenants.find(t => t.id === payment.tenantId);
        return tenant && tenant.name.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getPaymentsWithMissingTenants = () => {
    return payments.filter(payment => !tenants.find(t => t.id === payment.tenantId));
  };

  const getPaymentsFromArchivedTenants = () => {
    return payments.filter(payment => {
      const tenant = tenants.find(t => t.id === payment.tenantId);
      return tenant && tenant.isArchived;
    });
  };

  const getMissingPayments = () => {
    if (!selectedMonth) return [];
    
    const [month, year] = selectedMonth.split('-');
    const monthIndex = parseInt(month) - 1;
    const yearNum = parseInt(year);
    
    // Get all active tenants (not archived)
    const activeTenants = tenants.filter(tenant => !tenant.isArchived);
    
    // Get payments for the selected month
    const monthPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate.getUTCMonth() === monthIndex && paymentDate.getUTCFullYear() === yearNum;
    });
    
    // Find tenants who didn't pay in the selected month
    const tenantsWithPayments = monthPayments.map(payment => payment.tenantId);
    const tenantsWithoutPayments = activeTenants.filter(tenant => 
      !tenantsWithPayments.includes(tenant.id)
    );
    
    return tenantsWithoutPayments.map(tenant => ({
      tenantId: tenant.id,
      tenantName: tenant.name,
      expectedAmount: tenant.rentAmount,
      month: selectedMonth,
      property: properties.find(p => p.id === tenant.propertyId)?.name || 'Unknown Property'
    }));
  };

  const missingTenantsCount = getPaymentsWithMissingTenants().length;
  const archivedTenantsCount = getPaymentsFromArchivedTenants().length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const paymentData = {
        ...newPayment,
        paymentMethod: 'bank_transfer' // Always set to bank transfer
      };

      const response = await fetch(`${config.apiUrl}/api/payments`, {
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

      const response = await fetch(`${config.apiUrl}/api/payments/${selectedPayment.id}`, {
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
      const response = await fetch(`${config.apiUrl}/api/payments/${selectedPayment.id}`, {
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

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="property-filter-label">Filter by Property</InputLabel>
                <Select
                  labelId="property-filter-label"
                  value={selectedProperty}
                  label="Filter by Property"
                  onChange={handlePropertyChange}
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
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Search by Tenant Name"
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant={showMissingPayments ? "contained" : "outlined"}
                color="error"
                onClick={handleMissingPaymentsToggle}
                fullWidth
                sx={{ height: '56px' }}
              >
                {showMissingPayments ? "Show All Payments" : "Show Missing Payments"}
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              {showMissingPayments && (
                <TextField
                  fullWidth
                  label="Select Month"
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              )}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                {showMissingPayments ? (
                  <>
                    Showing {getMissingPayments().length} tenants with missing payments for {selectedMonth ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'selected month'}
                  </>
                ) : (
                  <>
                    Showing {getFilteredPayments().length} of {payments.length} payments
                    {missingTenantsCount > 0 && (
                      <span style={{ color: '#f57c00' }}>
                        {' '}({missingTenantsCount} with missing tenant data)
                      </span>
                    )}
                    {archivedTenantsCount > 0 && (
                      <span style={{ color: '#666' }}>
                        {' '}({archivedTenantsCount} from archived tenants)
                      </span>
                    )}
                  </>
                )}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {showMissingPayments ? (
                  <>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell align="right">Expected Amount</TableCell>
                    <TableCell>Month</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>Date</TableCell>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {showMissingPayments ? (
                getMissingPayments().map((missingPayment) => (
                  <TableRow key={`${missingPayment.tenantId}-${missingPayment.month}`}>
                    <TableCell>
                      {missingPayment.tenantName}
                    </TableCell>
                    <TableCell>{missingPayment.property}</TableCell>
                    <TableCell align="right">${missingPayment.expectedAmount}</TableCell>
                    <TableCell>
                      {new Date(missingPayment.month + '-01').toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long'
                      })}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={() => {
                          // Pre-fill the add payment form with tenant and month
                          setNewPayment({
                            tenantId: missingPayment.tenantId,
                            amount: missingPayment.expectedAmount,
                            date: missingPayment.month + '-01',
                            notes: '',
                          });
                          setOpen(true);
                        }}
                      >
                        Add Payment
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                getFilteredPayments().map((payment) => {
                  const tenant = tenants.find(t => t.id === payment.tenantId);
                  const property = properties.find(p => p.id === tenant?.propertyId);
                  
                  // Debug logging for missing tenants
                  if (!tenant) {
                    console.warn(`Payment ${payment.id} references non-existent tenant ${payment.tenantId}`);
                  }
                  
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {new Date(payment.date).toLocaleDateString('en-US', {
                          timeZone: 'UTC',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>
                        {tenant?.name || 'Unknown Tenant'}
                        {tenant?.isArchived && (
                          <Chip
                            label="Archived"
                            size="small"
                            color="default"
                            sx={{ ml: 1, fontSize: '0.7rem' }}
                          />
                        )}
                      </TableCell>
                      <TableCell>{property?.name || 'Unknown Property'}</TableCell>
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
                  );
                })
              )}
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
            <Box component="form" id="edit-payment-form" onSubmit={handleEdit} sx={{ mt: 2 }}>
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
            <Button type="submit" variant="contained" color="primary" form="edit-payment-form">
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