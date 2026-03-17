import React from 'react';
import { Box, Skeleton, Grid, Paper } from '@mui/material';

/**
 * Reusable loading skeleton component.
 * @param {object} props
 * @param {'table'|'cards'|'stats'} props.variant - Type of skeleton to render
 * @param {number} [props.rows=5] - Number of rows for table variant
 * @param {number} [props.count=4] - Number of cards/stats items
 */
const LoadingSkeleton = ({ variant = 'table', rows = 5, count = 4 }) => {
  if (variant === 'table') {
    return (
      <Box>
        {/* Table header */}
        <Skeleton variant="rectangular" height={48} sx={{ mb: 1, borderRadius: 1 }} />
        {/* Table rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={40}
            sx={{ mb: 0.5, borderRadius: 1 }}
          />
        ))}
      </Box>
    );
  }

  if (variant === 'cards') {
    return (
      <Grid container spacing={3}>
        {Array.from({ length: count }).map((_, i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <Paper sx={{ p: 2 }}>
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="50%" />
            </Paper>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (variant === 'stats') {
    return (
      <Grid container spacing={3}>
        {Array.from({ length: count }).map((_, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Paper sx={{ p: 2, height: 120 }}>
              <Skeleton variant="text" width="70%" height={28} />
              <Skeleton variant="text" width="50%" height={40} />
            </Paper>
          </Grid>
        ))}
      </Grid>
    );
  }

  return null;
};

export default LoadingSkeleton;
