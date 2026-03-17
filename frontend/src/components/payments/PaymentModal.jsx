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

/**
 * Payment add/edit modal extracted from Payments.jsx.
 * Receives all necessary state and handlers as props.
 */
const PaymentModal = ({
  open,
  onClose,
  onSubmit,
  title,
  submitText,
  formId,
  newPayment,
  handleChange,
  tenants,
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box component="form" id={formId} onSubmit={onSubmit} sx={{ mt: 2 }}>
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
            select
            label="Status"
            name="status"
            value={newPayment.status}
            onChange={handleChange}
            margin="normal"
            required
          >
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="late">Late</MenuItem>
            <MenuItem value="partial">Partial</MenuItem>
          </TextField>
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
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          form={formId}
          onClick={onSubmit}
        >
          {submitText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentModal;
