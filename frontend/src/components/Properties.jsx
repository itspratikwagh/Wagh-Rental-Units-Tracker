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
} from '@mui/material';

const Properties = () => {
  const [properties, setProperties] = useState([]);
  const [open, setOpen] = useState(false);
  const [newProperty, setNewProperty] = useState({
    name: '',
    address: '',
    type: '',
    units: '',
    rentAmount: '',
  });

  useEffect(() => {
    fetchProperties();
  }, []);

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
    setNewProperty({
      ...newProperty,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3003/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProperty),
      });
      if (response.ok) {
        fetchProperties();
        handleClose();
        setNewProperty({
          name: '',
          address: '',
          type: '',
          units: '',
          rentAmount: '',
        });
      }
    } catch (error) {
      console.error('Error creating property:', error);
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

        <Grid container spacing={3}>
          {properties.map((property) => (
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
                    Rent Amount: ${property.rentAmount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Property Name"
                name="name"
                value={newProperty.name}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Address"
                name="address"
                value={newProperty.address}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Type"
                name="type"
                value={newProperty.type}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Number of Units"
                name="units"
                type="number"
                value={newProperty.units}
                onChange={handleChange}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Rent Amount"
                name="rentAmount"
                type="number"
                value={newProperty.rentAmount}
                onChange={handleChange}
                margin="normal"
                required
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Add Property
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Properties; 