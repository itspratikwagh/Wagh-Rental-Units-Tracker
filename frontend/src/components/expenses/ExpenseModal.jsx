import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  MenuItem,
} from '@mui/material';

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

/**
 * Expense add/edit modal extracted from Expenses.jsx.
 * Receives all necessary state and handlers as props.
 */
const ExpenseModal = ({
  open,
  onClose,
  onSubmit,
  title,
  submitText,
  newExpense,
  handleChange,
  properties,
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={onSubmit} sx={{ mt: 2 }}>
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
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} variant="contained" color="primary">
          {submitText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExpenseModal;
