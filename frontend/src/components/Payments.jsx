import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Chip,
  Menu,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import config from '../config';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [newPayment, setNewPayment] = useState({
    tenantId: '',
    amount: '',
    date: '',
    notes: '',
    status: 'completed',
  });
  const [error, setError] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMissingPayments, setShowMissingPayments] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);

  useEffect(() => {
    fetchPayments();
    fetchTenants();
    fetchProperties();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/payments`);
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      // Make two separate calls to work around backend API issue
      const [currentResponse, archivedResponse] = await Promise.all([
        fetch(`${config.apiUrl}/api/tenants`),
        fetch(`${config.apiUrl}/api/tenants?includeArchived=true`)
      ]);
      
      if (!currentResponse.ok || !archivedResponse.ok) {
        throw new Error('Failed to fetch tenants');
      }
      
      const currentTenants = await currentResponse.json();
      const archivedTenants = await archivedResponse.json();
      
      // Combine and deduplicate tenants
      const allTenants = [...currentTenants];
      
      // Add archived tenants that aren't already in the current list
      archivedTenants.forEach(archivedTenant => {
        if (!allTenants.find(tenant => tenant.id === archivedTenant.id)) {
          allTenants.push(archivedTenant);
        }
      });
      
      setTenants(allTenants);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/properties`);
      const data = await response.json();
      setProperties(data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setNewPayment({
      tenantId: '',
      amount: '',
      date: '',
      notes: '',
      status: 'completed',
    });
    setError(null);
  };

  const handleEditOpen = (payment) => {
    setSelectedPayment(payment);
    setNewPayment({
      tenantId: payment.tenantId,
      amount: payment.amount,
      date: new Date(payment.date).toISOString().split('T')[0],
      notes: payment.notes || '',
      status: payment.status || 'completed',
    });
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setSelectedPayment(null);
    setNewPayment({
      tenantId: '',
      amount: '',
      date: '',
      notes: '',
      status: 'completed',
    });
    setError(null);
  };

  const handleDeleteOpen = (payment) => {
    setSelectedPayment(payment);
    setDeleteOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteOpen(false);
    setSelectedPayment(null);
  };

  const handleChange = (e) => {
    setNewPayment({
      ...newPayment,
      [e.target.name]: e.target.value,
    });
  };

  const handlePropertyChange = (event) => {
    setSelectedProperty(event.target.value);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleMissingPaymentsToggle = () => {
    setShowMissingPayments(!showMissingPayments);
    if (!showMissingPayments) {
      setSelectedMonth(new Date().toISOString().slice(0, 7)); // Current month as default
    }
  };

  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };

  // Helper function to calculate days overdue
  const calculateDaysOverdue = (paymentDate) => {
    const dueDate = new Date(paymentDate);
    dueDate.setDate(1); // Due on 1st of month
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3); // 3 days grace period
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (today > gracePeriodEnd) {
      const diffTime = Math.abs(today - gracePeriodEnd);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    return 0;
  };

  // Helper function to get actual payment status (with late detection)
  const getPaymentStatus = (payment) => {
    if (payment.status === 'completed' || payment.status === 'partial') {
      return payment.status;
    }
    
    // Check if pending payment is now late
    const daysOverdue = calculateDaysOverdue(payment.date);
    if (daysOverdue > 0 && payment.status === 'pending') {
      return 'late';
    }
    
    return payment.status;
  };

  // Get date range based on selection
  const getDateRangeValues = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    switch (dateRange) {
      case 'thisWeek': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        return { start: startOfWeek, end: now };
      }
      case 'thisMonth': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: startOfMonth, end: now };
      }
      case 'last3Months': {
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        threeMonthsAgo.setHours(0, 0, 0, 0);
        return { start: threeMonthsAgo, end: now };
      }
      case 'thisYear': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return { start: startOfYear, end: now };
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(customEndDate + 'T23:59:59')
          };
        }
        return null;
      }
      default:
        return null;
    }
  };

  // Calculate summary statistics
  const calculateSummaryStats = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Filter payments by current month
    const thisMonthPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate.getMonth() === currentMonth && 
             paymentDate.getFullYear() === currentYear &&
             (payment.status === 'completed' || payment.status === 'partial');
    });
    
    // Filter payments by current year
    const thisYearPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate.getFullYear() === currentYear &&
             (payment.status === 'completed' || payment.status === 'partial');
    });
    
    // Calculate totals
    const totalThisMonth = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalThisYear = thisYearPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Calculate expected for this month (active tenants only)
    const activeTenants = tenants.filter(t => !t.isArchived);
    const expectedThisMonth = activeTenants.reduce((sum, t) => sum + t.rentAmount, 0);
    
    // Calculate collection rate
    const collectionRate = expectedThisMonth > 0 
      ? (totalThisMonth / expectedThisMonth) * 100 
      : 0;
    
    // Count late and pending payments
    const latePayments = payments.filter(p => getPaymentStatus(p) === 'late');
    const pendingPayments = payments.filter(p => p.status === 'pending' && getPaymentStatus(p) === 'pending');
    
    const totalLateAmount = latePayments.reduce((sum, p) => sum + p.amount, 0);
    const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
    
    return {
      totalThisMonth,
      totalThisYear,
      expectedThisMonth,
      collectionRate,
      lateCount: latePayments.length,
      lateAmount: totalLateAmount,
      pendingCount: pendingPayments.length,
      pendingAmount: totalPendingAmount,
    };
  };

  const getFilteredPayments = () => {
    let filtered = [...payments];

    // Filter by date range
    const dateRangeValues = getDateRangeValues();
    if (dateRangeValues) {
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.date);
        return paymentDate >= dateRangeValues.start && paymentDate <= dateRangeValues.end;
      });
    }

    // Filter by property
    if (selectedProperty !== 'all') {
      filtered = filtered.filter(payment => {
        const tenant = tenants.find(t => t.id === payment.tenantId);
        return tenant && tenant.propertyId === selectedProperty;
      });
    }

    // Filter by search term (tenant name)
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(payment => {
        const tenant = tenants.find(t => t.id === payment.tenantId);
        return tenant && tenant.name.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getPaymentsWithMissingTenants = () => {
    return payments.filter(payment => !tenants.find(t => t.id === payment.tenantId));
  };

  const getPaymentsFromArchivedTenants = () => {
    return payments.filter(payment => {
      const tenant = tenants.find(t => t.id === payment.tenantId);
      return tenant && tenant.isArchived;
    });
  };

  const getMissingPayments = () => {
    if (!selectedMonth) return [];
    
    const [month, year] = selectedMonth.split('-');
    const monthIndex = parseInt(month) - 1;
    const yearNum = parseInt(year);
    
    // Get all active tenants (not archived)
    const activeTenants = tenants.filter(tenant => !tenant.isArchived);
    
    // Get payments for the selected month
    const monthPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate.getUTCMonth() === monthIndex && paymentDate.getUTCFullYear() === yearNum;
    });
    
    // Find tenants who didn't pay in the selected month
    const tenantsWithPayments = monthPayments.map(payment => payment.tenantId);
    const tenantsWithoutPayments = activeTenants.filter(tenant => 
      !tenantsWithPayments.includes(tenant.id)
    );
    
    return tenantsWithoutPayments.map(tenant => ({
      tenantId: tenant.id,
      tenantName: tenant.name,
      expectedAmount: tenant.rentAmount,
      month: selectedMonth,
      property: properties.find(p => p.id === tenant.propertyId)?.name || 'Unknown Property'
    }));
  };

  const missingTenantsCount = getPaymentsWithMissingTenants().length;
  const archivedTenantsCount = getPaymentsFromArchivedTenants().length;

  // Export to CSV
  const exportToCSV = () => {
    const filtered = getFilteredPayments();
    const stats = calculateSummaryStats();
    
    let csvContent = "Wagh Rental Properties - Payment Report\n";
    csvContent += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    csvContent += "Summary Statistics\n";
    csvContent += `Total This Month,$${stats.totalThisMonth.toFixed(2)}\n`;
    csvContent += `Total This Year,$${stats.totalThisYear.toFixed(2)}\n`;
    csvContent += `Expected This Month,$${stats.expectedThisMonth.toFixed(2)}\n`;
    csvContent += `Collection Rate,${stats.collectionRate.toFixed(1)}%\n`;
    csvContent += `Late Payments,${stats.lateCount} ($${stats.lateAmount.toFixed(2)})\n`;
    csvContent += `Pending Payments,${stats.pendingCount} ($${stats.pendingAmount.toFixed(2)})\n\n`;
    
    csvContent += "Date,Tenant,Property,Amount,Status,Days Overdue,Notes\n";
    
    filtered.forEach(payment => {
      const tenant = tenants.find(t => t.id === payment.tenantId);
      const property = properties.find(p => p.id === tenant?.propertyId);
      const status = getPaymentStatus(payment);
      const daysOverdue = status === 'late' ? calculateDaysOverdue(payment.date) : 0;
      
      const row = [
        new Date(payment.date).toLocaleDateString('en-US', { timeZone: 'UTC' }),
        tenant?.name || 'Unknown',
        property?.name || 'Unknown',
        `$${payment.amount}`,
        status.toUpperCase(),
        daysOverdue > 0 ? daysOverdue : '',
        `"${(payment.notes || '').replace(/"/g, '""')}"`
      ].join(',');
      
      csvContent += row + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payments_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMenuAnchor(null);
  };

  // Export to PDF
  const exportToPDF = () => {
    const filtered = getFilteredPayments();
    const stats = calculateSummaryStats();
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('Wagh Rental Properties', 14, 20);
    doc.setFontSize(14);
    doc.text('Payment Report', 14, 28);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);
    
    // Summary Statistics
    doc.setFontSize(12);
    doc.text('Summary Statistics', 14, 45);
    doc.setFontSize(10);
    
    const summaryData = [
      ['Total This Month', `$${stats.totalThisMonth.toFixed(2)}`],
      ['Total This Year', `$${stats.totalThisYear.toFixed(2)}`],
      ['Expected This Month', `$${stats.expectedThisMonth.toFixed(2)}`],
      ['Collection Rate', `${stats.collectionRate.toFixed(1)}%`],
      ['Late Payments', `${stats.lateCount} ($${stats.lateAmount.toFixed(2)})`],
      ['Pending Payments', `${stats.pendingCount} ($${stats.pendingAmount.toFixed(2)})`],
    ];
    
    doc.autoTable({
      startY: 50,
      head: [],
      body: summaryData,
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 50 }
      }
    });
    
    // Payment Details Table
    const tableData = filtered.map(payment => {
      const tenant = tenants.find(t => t.id === payment.tenantId);
      const property = properties.find(p => p.id === tenant?.propertyId);
      const status = getPaymentStatus(payment);
      const daysOverdue = status === 'late' ? calculateDaysOverdue(payment.date) : 0;
      
      return [
        new Date(payment.date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }),
        tenant?.name || 'Unknown',
        property?.name || 'Unknown',
        `$${payment.amount}`,
        status.toUpperCase(),
        daysOverdue > 0 ? `${daysOverdue}d` : '',
      ];
    });
    
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Date', 'Tenant', 'Property', 'Amount', 'Status', 'Overdue']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: {
        3: { halign: 'right' },
        5: { halign: 'center' }
      }
    });
    
    doc.save(`payments_report_${new Date().toISOString().split('T')[0]}.pdf`);
    setExportMenuAnchor(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const paymentData = {
        ...newPayment,
        paymentMethod: 'bank_transfer' // Always set to bank transfer
      };

      const response = await fetch(`${config.apiUrl}/api/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment');
      }

      fetchPayments();
      handleClose();
    } catch (error) {
      console.error('Error creating payment:', error);
      setError(error.message);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const paymentData = {
        ...newPayment,
        paymentMethod: 'bank_transfer' // Always set to bank transfer
      };

      const response = await fetch(`${config.apiUrl}/api/payments/${selectedPayment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update payment');
      }

      fetchPayments();
      handleEditClose();
    } catch (error) {
      console.error('Error updating payment:', error);
      setError(error.message);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/payments/${selectedPayment.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete payment');
      }

      fetchPayments();
      handleDeleteClose();
    } catch (error) {
      console.error('Error deleting payment:', error);
      setError(error.message);
    }
  };

  const stats = calculateSummaryStats();
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Payments
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={() => setExportMenuAnchor(null)}
            >
              <MenuItem onClick={exportToCSV}>Export to CSV</MenuItem>
              <MenuItem onClick={exportToPDF}>Export to PDF</MenuItem>
            </Menu>
            <Button variant="contained" color="primary" onClick={handleOpen}>
              Add Payment
            </Button>
          </Box>
        </Box>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Total This Month
              </Typography>
              <Typography component="p" variant="h4" color="success.main">
                ${stats.totalThisMonth.toFixed(2)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Total This Year
              </Typography>
              <Typography component="p" variant="h4">
                ${stats.totalThisYear.toFixed(2)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Expected This Month
              </Typography>
              <Typography component="p" variant="h4">
                ${stats.expectedThisMonth.toFixed(2)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Collection Rate
              </Typography>
              <Typography 
                component="p" 
                variant="h4" 
                color={stats.collectionRate >= 90 ? 'success.main' : stats.collectionRate >= 70 ? 'warning.main' : 'error'}
              >
                {stats.collectionRate.toFixed(1)}%
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography component="h2" variant="h6" color="error" gutterBottom>
                Late Payments
              </Typography>
              <Typography component="p" variant="h4" color="error">
                {stats.lateCount}
              </Typography>
              <Typography component="p" variant="body2" color="text.secondary">
                ${stats.lateAmount.toFixed(2)} overdue
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 120 }}>
              <Typography component="h2" variant="h6" color="warning.main" gutterBottom>
                Pending Payments
              </Typography>
              <Typography component="p" variant="h4" color="warning.main">
                {stats.pendingCount}
              </Typography>
              <Typography component="p" variant="body2" color="text.secondary">
                ${stats.pendingAmount.toFixed(2)} pending
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Date Range Filter */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Date Range Filter
              </Typography>
              <ToggleButtonGroup
                value={dateRange}
                exclusive
                onChange={(e, newValue) => newValue && setDateRange(newValue)}
                size="small"
                sx={{ flexWrap: 'wrap' }}
              >
                <ToggleButton value="all">All Time</ToggleButton>
                <ToggleButton value="thisWeek">This Week</ToggleButton>
                <ToggleButton value="thisMonth">This Month</ToggleButton>
                <ToggleButton value="last3Months">Last 3 Months</ToggleButton>
                <ToggleButton value="thisYear">This Year</ToggleButton>
                <ToggleButton value="custom">Custom Range</ToggleButton>
              </ToggleButtonGroup>
            </Grid>
            
            {dateRange === 'custom' && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Start Date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="End Date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
              </>
            )}
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="property-filter-label">Filter by Property</InputLabel>
                <Select
                  labelId="property-filter-label"
                  value={selectedProperty}
                  label="Filter by Property"
                  onChange={handlePropertyChange}
                >
                  <MenuItem value="all">All Properties</MenuItem>
                  {properties.map((property) => (
                    <MenuItem key={property.id} value={property.id}>
                      {property.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Search by Tenant Name"
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant={showMissingPayments ? "contained" : "outlined"}
                color="error"
                onClick={handleMissingPaymentsToggle}
                fullWidth
                sx={{ height: '56px' }}
              >
                {showMissingPayments ? "Show All Payments" : "Show Missing Payments"}
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              {showMissingPayments && (
                <TextField
                  fullWidth
                  label="Select Month"
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              )}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                {showMissingPayments ? (
                  <>
                    Showing {getMissingPayments().length} tenants with missing payments for {selectedMonth ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'selected month'}
                  </>
                ) : (
                  <>
                    Showing {getFilteredPayments().length} of {payments.length} payments
                    {missingTenantsCount > 0 && (
                      <span style={{ color: '#f57c00' }}>
                        {' '}({missingTenantsCount} with missing tenant data)
                      </span>
                    )}
                    {archivedTenantsCount > 0 && (
                      <span style={{ color: '#666' }}>
                        {' '}({archivedTenantsCount} from archived tenants)
                      </span>
                    )}
                  </>
                )}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {showMissingPayments ? (
                  <>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell align="right">Expected Amount</TableCell>
                    <TableCell>Month</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>Date</TableCell>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {showMissingPayments ? (
                getMissingPayments().map((missingPayment) => (
                  <TableRow key={`${missingPayment.tenantId}-${missingPayment.month}`}>
                    <TableCell>
                      {missingPayment.tenantName}
                    </TableCell>
                    <TableCell>{missingPayment.property}</TableCell>
                    <TableCell align="right">${missingPayment.expectedAmount}</TableCell>
                    <TableCell>
                      {new Date(missingPayment.month + '-01').toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long'
                      })}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={() => {
                          // Pre-fill the add payment form with tenant and month
                          setNewPayment({
                            tenantId: missingPayment.tenantId,
                            amount: missingPayment.expectedAmount,
                            date: missingPayment.month + '-01',
                            notes: '',
                            status: 'pending',
                          });
                          setOpen(true);
                        }}
                      >
                        Add Payment
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                getFilteredPayments().map((payment) => {
                  const tenant = tenants.find(t => t.id === payment.tenantId);
                  const property = properties.find(p => p.id === tenant?.propertyId);
                  const actualStatus = getPaymentStatus(payment);
                  const daysOverdue = actualStatus === 'late' ? calculateDaysOverdue(payment.date) : 0;
                  
                  // Debug logging for missing tenants
                  if (!tenant) {
                    console.warn(`Payment ${payment.id} references non-existent tenant ${payment.tenantId}`);
                  }

                  // Determine row background color based on status
                  const getRowStyle = () => {
                    if (actualStatus === 'late') {
                      return { backgroundColor: '#ffebee' }; // Light red
                    } else if (actualStatus === 'pending') {
                      return { backgroundColor: '#fff9c4' }; // Light yellow
                    }
                    return {};
                  };

                  // Get status chip
                  const renderStatusChip = () => {
                    switch (actualStatus) {
                      case 'completed':
                        return (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Completed"
                            color="success"
                            size="small"
                          />
                        );
                      case 'pending':
                        return (
                          <Chip
                            icon={<PendingIcon />}
                            label="Pending"
                            color="warning"
                            size="small"
                          />
                        );
                      case 'late':
                        return (
                          <Chip
                            icon={<WarningIcon />}
                            label={`Late (${daysOverdue}d)`}
                            color="error"
                            size="small"
                          />
                        );
                      case 'partial':
                        return (
                          <Chip
                            label="Partial"
                            color="info"
                            size="small"
                          />
                        );
                      default:
                        return (
                          <Chip
                            label={actualStatus}
                            size="small"
                          />
                        );
                    }
                  };
                  
                  return (
                    <TableRow key={payment.id} sx={getRowStyle()}>
                      <TableCell>
                        {new Date(payment.date).toLocaleDateString('en-US', {
                          timeZone: 'UTC',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>
                        {tenant?.name || 'Unknown Tenant'}
                        {tenant?.isArchived && (
                          <Chip
                            label="Archived"
                            size="small"
                            color="default"
                            sx={{ ml: 1, fontSize: '0.7rem' }}
                          />
                        )}
                      </TableCell>
                      <TableCell>{property?.name || 'Unknown Property'}</TableCell>
                      <TableCell align="right">${payment.amount}</TableCell>
                      <TableCell>{renderStatusChip()}</TableCell>
                      <TableCell>{payment.notes}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => handleEditOpen(payment)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteOpen(payment)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Add Payment Dialog */}
        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>Add New Payment</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
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
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Add Payment
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Payment Dialog */}
        <Dialog open={editOpen} onClose={handleEditClose}>
          <DialogTitle>Edit Payment</DialogTitle>
          <DialogContent>
            <Box component="form" id="edit-payment-form" onSubmit={handleEdit} sx={{ mt: 2 }}>
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
            <Button onClick={handleEditClose}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" form="edit-payment-form">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteOpen} onClose={handleDeleteClose}>
          <DialogTitle>Delete Payment</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this payment? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteClose}>Cancel</Button>
            <Button onClick={handleDelete} variant="contained" color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Payments; 