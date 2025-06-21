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
  IconButton,
  CardActions,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import config from '../config';

const Tenants = () => {
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [newTenant, setNewTenant] = useState({
    name: '',
    email: '',
    phone: '',
    propertyId: '',
    rentAmount: '',
    leaseStart: '',
    leaseEnd: '',
  });

  useEffect(() => {
    fetchTenants();
    fetchProperties();
  }, [tabValue]);

  const fetchTenants = async () => {
    try {
      setError(null);
      const includeArchived = tabValue === 1;
      const response = await fetch(`${config.apiUrl}/api/tenants?includeArchived=${includeArchived}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }
      const data = await response.json();
      setTenants(data);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      setError('Failed to load tenants. Please try again later.');
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

  const handleOpen = () => {
    setEditingTenant(null);
    setNewTenant({
      name: '',
      email: '',
      phone: '',
      propertyId: '',
      rentAmount: '',
      leaseStart: '',
      leaseEnd: '',
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingTenant(null);
  };

  const handleEditOpen = (tenant) => {
    setEditingTenant(tenant);
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditingTenant(null);
    setEditOpen(false);
  };

  const handleChange = (e) => {
    if (editingTenant) {
      setEditingTenant({
        ...editingTenant,
        [e.target.name]: e.target.value,
      });
    } else {
      setNewTenant({
        ...newTenant,
        [e.target.name]: e.target.value,
      });
    }
  };

  const handleEditChange = (e) => {
    setEditingTenant({
      ...editingTenant,
      [e.target.name]: e.target.value,
    });
  };

  const handleDelete = async (tenantId) => {
    if (window.confirm('Are you sure you want to delete this tenant?')) {
      try {
        const response = await fetch(`${config.apiUrl}/api/tenants/${tenantId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          fetchTenants();
        }
      } catch (error) {
        console.error('Error deleting tenant:', error);
        setError('Failed to delete tenant. Please try again.');
      }
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const tenantData = {
        ...editingTenant,
        rentAmount: parseFloat(editingTenant.rentAmount),
        leaseStart: new Date(editingTenant.leaseStart).toISOString(),
        leaseEnd: new Date(editingTenant.leaseEnd).toISOString(),
      };

      const response = await fetch(`${config.apiUrl}/api/tenants/${editingTenant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tenantData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update tenant');
      }

      fetchTenants();
      handleEditClose();
    } catch (error) {
      console.error('Error updating tenant:', error);
      setError(error.message || 'Failed to update tenant. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingTenant
        ? `${config.apiUrl}/api/tenants/${editingTenant.id}`
        : `${config.apiUrl}/api/tenants`;
      const method = editingTenant ? 'PUT' : 'POST';
      
      const data = editingTenant ? {
        ...editingTenant,
        rentAmount: parseFloat(editingTenant.rentAmount),
        leaseStart: new Date(editingTenant.leaseStart).toISOString(),
        leaseEnd: new Date(editingTenant.leaseEnd).toISOString(),
      } : {
        ...newTenant,
        rentAmount: parseFloat(newTenant.rentAmount),
        leaseStart: new Date(newTenant.leaseStart).toISOString(),
        leaseEnd: new Date(newTenant.leaseEnd).toISOString(),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save tenant');
      }

      fetchTenants();
      handleClose();
    } catch (error) {
      console.error('Error saving tenant:', error);
      setError(error.message || 'Failed to save tenant. Please try again.');
    }
  };

  const handleArchive = async (tenantId) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/tenants/${tenantId}/archive`, {
        method: 'PUT',
      });
      if (response.ok) {
        fetchTenants();
      }
    } catch (error) {
      console.error('Error archiving tenant:', error);
      setError('Failed to archive tenant. Please try again.');
    }
  };

  const handleUnarchive = async (tenantId) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/tenants/${tenantId}/unarchive`, {
        method: 'PUT',
      });
      if (response.ok) {
        fetchTenants();
      }
    } catch (error) {
      console.error('Error unarchiving tenant:', error);
      setError('Failed to unarchive tenant. Please try again.');
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Tenants
          </Typography>
          <Button variant="contained" color="primary" onClick={handleOpen}>
            Add Tenant
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
          <Tab label="Current Tenants" />
          <Tab label="Archived Tenants" />
        </Tabs>

        <Grid container spacing={3}>
          {tenants.map((tenant) => (
            <Grid item xs={12} sm={6} md={4} key={tenant.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {tenant.name}
                  </Typography>
                  <Typography color="textSecondary" gutterBottom>
                    {tenant.email}
                  </Typography>
                  <Typography variant="body2">
                    Phone: {tenant.phone}
                  </Typography>
                  <Typography variant="body2">
                    Property: {tenant.property?.name}
                  </Typography>
                  <Typography variant="body2">
                    Rent: ${tenant.rentAmount}
                  </Typography>
                  <Typography variant="body2">
                    Lease: {new Date(tenant.leaseStart).toLocaleDateString()} - {new Date(tenant.leaseEnd).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  {!tenant.isArchived && (
                    <>
                      <IconButton onClick={() => handleEditOpen(tenant)} color="primary">
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => handleArchive(tenant.id)} color="warning">
                        <ArchiveIcon />
                      </IconButton>
                    </>
                  )}
                  {tenant.isArchived && (
                    <IconButton onClick={() => handleUnarchive(tenant.id)} color="success">
                      <UnarchiveIcon />
                    </IconButton>
                  )}
                  <IconButton onClick={() => handleDelete(tenant.id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>{editingTenant ? 'Edit Tenant' : 'Add New Tenant'}</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Name"
                name="name"
                value={editingTenant ? editingTenant.name : newTenant.name}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={editingTenant ? editingTenant.email : newTenant.email}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={editingTenant ? editingTenant.phone : newTenant.phone}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                select
                label="Property"
                name="propertyId"
                value={editingTenant ? editingTenant.propertyId : newTenant.propertyId}
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
                label="Rent Amount"
                name="rentAmount"
                type="number"
                value={editingTenant ? editingTenant.rentAmount : newTenant.rentAmount}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Lease Start"
                name="leaseStart"
                type="date"
                value={editingTenant ? editingTenant.leaseStart.split('T')[0] : newTenant.leaseStart}
                onChange={handleChange}
                margin="normal"
                required
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label="Lease End"
                name="leaseEnd"
                type="date"
                value={editingTenant ? editingTenant.leaseEnd.split('T')[0] : newTenant.leaseEnd}
                onChange={handleChange}
                margin="normal"
                required
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              {editingTenant ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Tenants; 