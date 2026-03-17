import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Consistent page header with title and optional action button.
 * @param {object} props
 * @param {string} props.title - Page title
 * @param {React.ReactNode} [props.action] - Action button element
 * @param {string} [props.subtitle] - Optional subtitle text
 */
const PageHeader = ({ title, action, subtitle }) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
      <Box>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box>{action}</Box>}
    </Box>
  );
};

export default PageHeader;
