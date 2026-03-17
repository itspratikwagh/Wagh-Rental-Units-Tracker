/**
 * Format a date string to "Jan 15, 2025" format
 * @param {string} dateStr - Date string to format
 * @returns {string} Formatted date
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a number to "$1,234.56" currency format
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format a date string to "January 2025" format
 * @param {string} dateStr - Date string to format
 * @returns {string} Formatted month string
 */
export const formatMonth = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
  });
};
