import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';

/**
 * Reusable confirmation dialog component.
 * @param {object} props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Confirmation message
 * @param {function} props.onConfirm - Handler for confirm action
 * @param {function} props.onCancel - Handler for cancel action
 * @param {string} [props.confirmText='Confirm'] - Text for confirm button
 * @param {string} [props.cancelText='Cancel'] - Text for cancel button
 * @param {string} [props.confirmColor='error'] - Color for confirm button
 */
const ConfirmDialog = ({
  open,
  title = 'Confirm Action',
  message = 'Are you sure?',
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'error',
}) => {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelText}</Button>
        <Button onClick={onConfirm} variant="contained" color={confirmColor}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
