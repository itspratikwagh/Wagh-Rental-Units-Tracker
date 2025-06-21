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
  IconButton,
  CardActions,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import config from '../config';

const Properties = () => {
  const [properties, setProperties] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [error, setError] = useState(null);
  const [newProperty, setNewProperty] = useState({
    name: '',
    address: '',
    type: '',
    units: '',
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      setError(null);
      const response = await fetch(`${config.apiUrl}/api/properties`);
      if (!response.ok) {
        throw new Error('Failed to fetch properties');
      }
      const data = await response.json();
      setProperties(data);
    } catch (error) {
      console.error('Error fetching properties:', error);
      setError('Failed to load properties. Please try again later.');
    }
  };

  const handleOpen = () => {
    setEditingProperty(null);
    setNewProperty({
      name: '',
      address: '',
      type: '',
      units: '',
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProperty(null);
  };

  const handleChange = (e) => {
    if (editingProperty) {
      setEditingProperty({
        ...editingProperty,
        [e.target.name]: e.target.value,
      });
    } else {
      setNewProperty({
        ...newProperty,
        [e.target.name]: e.target.value,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingProperty
        ? `${config.apiUrl}/api/properties/${editingProperty.id}`
        : `${config.apiUrl}/api/properties`;
      const method = editingProperty ? 'PUT' : 'POST';
      
      // Format the data before sending
      const data = editingProperty ? {
        ...editingProperty,
        units: parseInt(editingProperty.units, 10),
      } : {
        ...newProperty,
        units: parseInt(newProperty.units, 10),
      };

      console.log('Sending data to server:', data);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save property');
      }

      fetchProperties();
      handleClose();
    } catch (error) {
      console.error('Error saving property:', error);
      alert(error.message || 'Failed to save property. Please try again.');
    }
  };

  const handleEdit = (property) => {
    setEditingProperty(property);
    setOpen(true);
  };

  const handleDelete = async (propertyId) => {
    if (window.confirm('Are you sure you want to delete this property?')) {
      try {
        const response = await fetch(`${config.apiUrl}/api/properties/${propertyId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          fetchProperties();
        }
      } catch (error) {
        console.error('Error deleting property:', error);
      }
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Properties
          </Typography>
          <Button variant="contained" color="primary" onClick={handleOpen}>
            Add Property
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {properties.map((property) => {
            const totalRent = property.tenants?.reduce((sum, tenant) => sum + tenant.rentAmount, 0) || 0;
            return (
              <Grid item xs={12} sm={6} md={4} key={property.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {property.name}
                    </Typography>
                    <Typography color="textSecondary" gutterBottom>
                      {property.address}
                    </Typography>
                    <Typography variant="body2">
                      Type: {property.type}
                    </Typography>
                    <Typography variant="body2">
                      Units: {property.units}
                    </Typography>
                    <Typography variant="body2">
                      Total Monthly Rent: ${totalRent.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      Number of Tenants: {property.tenants?.length || 0}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <IconButton onClick={() => handleEdit(property)} color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(property.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>{editingProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Property Name"
                name="name"
                value={editingProperty ? editingProperty.name : newProperty.name}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Address"
                name="address"
                value={editingProperty ? editingProperty.address : newProperty.address}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Type"
                name="type"
                value={editingProperty ? editingProperty.type : newProperty.type}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Number of Units"
                name="units"
                type="number"
                value={editingProperty ? editingProperty.units : newProperty.units}
                onChange={handleChange}
                margin="normal"
                required
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              {editingProperty ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Properties; 