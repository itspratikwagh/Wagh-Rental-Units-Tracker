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
import { EXPENSE_CATEGORIES } from '../../config';

/**
 * Expense add/edit modal extracted from Expenses.jsx.
 * Receives all necessary state and handlers as props.
 */
const AIRBNB_ROOM_CATEGORIES = ['Airbnb', 'Common Airbnb Expenses'];

const ExpenseModal = ({
  open,
  onClose,
  onSubmit,
  title,
  submitText,
  newExpense,
  handleChange,
  properties,
  airbnbTenants = [],
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
          {AIRBNB_ROOM_CATEGORIES.includes(newExpense.category) && airbnbTenants.length > 0 && (
            <TextField
              fullWidth
              select
              label="Airbnb room"
              name="tenantId"
              value={newExpense.tenantId || ''}
              onChange={handleChange}
              margin="normal"
              helperText="Which room this expense belongs to (leave blank for common/unassigned)"
            >
              <MenuItem value="">— none —</MenuItem>
              {airbnbTenants.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
          )}
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
