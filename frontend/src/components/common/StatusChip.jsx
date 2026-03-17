import React from 'react';
import { Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import WarningIcon from '@mui/icons-material/Warning';

/**
 * Consistent status badge component used across Payments and Inbox.
 * @param {object} props
 * @param {string} props.status - Status value (completed, pending, late, partial, approved, rejected, etc.)
 * @param {string} [props.size='small'] - Chip size
 * @param {string} [props.label] - Custom label override
 */
const StatusChip = ({ status, size = 'small', label }) => {
  const getChipProps = () => {
    switch (status) {
      case 'completed':
        return { icon: <CheckCircleIcon />, label: label || 'Completed', color: 'success' };
      case 'pending':
        return { icon: <PendingIcon />, label: label || 'Pending', color: 'warning' };
      case 'late':
        return { icon: <WarningIcon />, label: label || 'Late', color: 'error' };
      case 'partial':
        return { label: label || 'Partial', color: 'info' };
      case 'approved':
        return { icon: <CheckCircleIcon />, label: label || 'Approved', color: 'success' };
      case 'rejected':
        return { label: label || 'Rejected', color: 'error' };
      case 'payment':
        return { label: label || 'Payment', color: 'primary' };
      case 'expense':
        return { label: label || 'Expense', color: 'secondary' };
      default:
        return { label: label || status, color: 'default' };
    }
  };

  const chipProps = getChipProps();

  return <Chip size={size} {...chipProps} />;
};

export default StatusChip;
