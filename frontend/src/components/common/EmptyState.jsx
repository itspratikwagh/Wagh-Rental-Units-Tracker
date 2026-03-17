import React from 'react';
import { Box, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

/**
 * Reusable empty state component.
 * @param {object} props
 * @param {React.ReactNode} [props.icon] - Icon to display
 * @param {string} props.title - Main message
 * @param {string} [props.subtitle] - Secondary message
 */
const EmptyState = ({
  icon,
  title = 'No data found',
  subtitle,
}) => {
  const IconComponent = icon || <InboxIcon sx={{ fontSize: 64, color: 'text.disabled' }} />;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 2,
      }}
    >
      {IconComponent}
      <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
};

export default EmptyState;
