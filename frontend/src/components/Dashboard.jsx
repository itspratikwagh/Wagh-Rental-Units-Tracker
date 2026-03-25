import { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import EditIcon from '@mui/icons-material/Edit';
import IconButton from '@mui/material/IconButton';
import axios from 'axios';
import config from '../config';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value || 0);

const formatPct = (value) => `${value >= 0 ? '+' : ''}${(value || 0).toFixed(1)}%`;

function Dashboard() {
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [investmentStats, setInvestmentStats] = useState(null);
  const [investmentTab, setInvestmentTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValues, setEditValues] = useState({ propertyId: '', currentMarketValue: '', currentMortgageBal: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both active and archived tenants to get complete data
        const [propertiesRes, activeTenantsRes, archivedTenantsRes, paymentsRes, expensesRes, investmentRes] = await Promise.all([
          axios.get(`${config.apiUrl}/api/properties`),
          axios.get(`${config.apiUrl}/api/tenants`),
          axios.get(`${config.apiUrl}/api/tenants?includeArchived=true`),
          axios.get(`${config.apiUrl}/api/payments`),
          axios.get(`${config.apiUrl}/api/expenses`),
          axios.get(`${config.apiUrl}/api/dashboard/investment-stats`).catch(() => ({ data: null })),
        ]);
        
        // Combine active and archived tenants, removing duplicates
        const activeTenants = activeTenantsRes.data;
        const archivedTenants = archivedTenantsRes.data;
        const allTenants = [...activeTenants];
        
        // Add archived tenants that aren't already in the active list
        archivedTenants.forEach(archivedTenant => {
          if (!allTenants.find(tenant => tenant.id === archivedTenant.id)) {
            allTenants.push(archivedTenant);
          }
        });
        
        setProperties(propertiesRes.data);
        setTenants(allTenants);
        setPayments(paymentsRes.data);
        setExpenses(expensesRes.data);
        if (investmentRes.data) setInvestmentStats(investmentRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleMonthClick = (monthYear) => {
    setSelectedMonth(monthYear);
    setModalOpen(true);
    setTabValue(0);
    setSelectedProperty('all');
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedMonth(null);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handlePropertyChange = (event) => {
    setSelectedProperty(event.target.value);
  };

  const getMonthData = (monthYear) => {
    const [month, year] = monthYear.split('/');
    const monthIndex = parseInt(month) - 1;
    const yearNum = parseInt(year);

    const monthPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      // Use UTC methods to avoid timezone issues
      return paymentDate.getUTCMonth() === monthIndex && paymentDate.getUTCFullYear() === yearNum;
    });

    const monthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      // Use UTC methods to avoid timezone issues
      return expenseDate.getUTCMonth() === monthIndex && expenseDate.getUTCFullYear() === yearNum;
    });

    return { monthPayments, monthExpenses };
  };

  const getFilteredPayments = (monthPayments) => {
    if (selectedProperty === 'all') {
      return monthPayments;
    }
    
    return monthPayments.filter(payment => {
      const tenant = tenants.find(t => t.id === payment.tenantId);
      return tenant && tenant.propertyId === selectedProperty;
    });
  };

  const totalMonthlyRent = tenants
    .filter(tenant => !tenant.isArchived) // Only include active tenants for monthly rent
    .reduce((sum, tenant) => sum + tenant.rentAmount, 0);
  const totalProperties = properties.length;
  const totalTenants = tenants.filter(tenant => !tenant.isArchived).length; // Only count active tenants
  const totalArchivedTenants = tenants.filter(tenant => tenant.isArchived).length; // Count archived tenants
  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Calculate average monthly expense
  const uniqueMonthsWithExpenses = new Set();
  expenses.forEach(expense => {
    const date = new Date(expense.date);
    const monthYear = `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
    uniqueMonthsWithExpenses.add(monthYear);
  });
  const averageMonthlyExpense = uniqueMonthsWithExpenses.size > 0 
    ? totalExpenses / uniqueMonthsWithExpenses.size 
    : 0;

  // Calculate total profit/loss
  const totalProfitLoss = totalPayments - totalExpenses;

  // Calculate monthly payment totals
  const monthlyPayments = payments.reduce((acc, payment) => {
    const date = new Date(payment.date);
    const monthYear = `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
    acc[monthYear] = (acc[monthYear] || 0) + payment.amount;
    return acc;
  }, {});

  // Calculate monthly expense totals
  const monthlyExpenses = expenses.reduce((acc, expense) => {
    const date = new Date(expense.date);
    const monthYear = `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
    acc[monthYear] = (acc[monthYear] || 0) + expense.amount;
    return acc;
  }, {});

  // Sort months in descending order (most recent first)
  const sortedMonths = Object.entries(monthlyPayments)
    .sort(([a], [b]) => {
      const [monthA, yearA] = a.split('/');
      const [monthB, yearB] = b.split('/');
      return yearB - yearA || monthB - monthA;
    });

  const sortedExpenseMonths = Object.entries(monthlyExpenses)
    .sort(([a], [b]) => {
      const [monthA, yearA] = a.split('/');
      const [monthB, yearB] = b.split('/');
      return yearB - yearA || monthB - monthA;
    });

  // Calculate monthly profits
  const monthlyProfits = {};
  const allMonths = new Set([...Object.keys(monthlyPayments), ...Object.keys(monthlyExpenses)]);
  
  allMonths.forEach(monthYear => {
    const payments = monthlyPayments[monthYear] || 0;
    const expenses = monthlyExpenses[monthYear] || 0;
    monthlyProfits[monthYear] = payments - expenses;
  });

  const sortedProfitMonths = Object.entries(monthlyProfits)
    .sort(([a], [b]) => {
      const [monthA, yearA] = a.split('/');
      const [monthB, yearB] = b.split('/');
      return yearB - yearA || monthB - monthA;
    });

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
            }}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Total Properties
            </Typography>
            <Typography component="p" variant="h4">
              {totalProperties}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
            }}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Total Tenants
            </Typography>
            <Typography component="p" variant="h4">
              {totalTenants}
            </Typography>
            {totalArchivedTenants > 0 && (
              <Typography component="p" variant="body2" color="text.secondary">
                + {totalArchivedTenants} archived
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
            }}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Monthly Rent Income
            </Typography>
            <Typography component="p" variant="h4">
              ${totalMonthlyRent.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
            }}
          >
            <Typography component="h2" variant="h6" color="error" gutterBottom>
              Average Monthly Expense
            </Typography>
            <Typography component="p" variant="h4" color="error">
              ${averageMonthlyExpense.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
            }}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Total Payments Received
            </Typography>
            <Typography component="p" variant="h4">
              ${totalPayments.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
            }}
          >
            <Typography component="h2" variant="h6" color="error" gutterBottom>
              Total Expenses
            </Typography>
            <Typography component="p" variant="h4" color="error">
              ${totalExpenses.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
            }}
          >
            <Typography component="h2" variant="h6" color={totalProfitLoss >= 0 ? "success.main" : "error"} gutterBottom>
              Total Profit/Loss
            </Typography>
            <Typography component="p" variant="h4" color={totalProfitLoss >= 0 ? "success.main" : "error"}>
              ${totalProfitLoss.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Investment Returns Section */}
      {investmentStats && investmentStats.properties.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Investment Returns
          </Typography>
          <Tabs
            value={investmentTab}
            onChange={(e, v) => setInvestmentTab(v)}
            sx={{ mb: 2 }}
          >
            {investmentStats.properties.map((p) => (
              <Tab key={p.propertyId} label={p.propertyName} />
            ))}
            <Tab label="Portfolio" />
          </Tabs>

          {investmentStats.properties.map((stat, idx) => (
            investmentTab === idx && (
              <Box key={stat.propertyId}>
                {/* Purchase Details */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Purchase Details ({stat.yearsHeld} years held)
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {[
                    { label: 'Purchase Price', value: formatCurrency(stat.purchasePrice) },
                    { label: 'Down Payment (5%)', value: formatCurrency(stat.downPayment) },
                    { label: 'Closing Costs', value: formatCurrency(stat.closingCosts) },
                    { label: 'Total Cash Invested', value: formatCurrency(stat.totalCashInvested), bold: true },
                  ].map((card) => (
                    <Grid item xs={6} md={3} key={card.label}>
                      <Paper sx={{ p: 2, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: card.bold ? 700 : 400 }}>{card.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {/* Current Position */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Current Position
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">Market Value</Typography>
                        <IconButton size="small" onClick={() => {
                          setEditValues({ propertyId: stat.propertyId, currentMarketValue: stat.currentMarketValue || '', currentMortgageBal: stat.currentMortgageBal || '' });
                          setEditDialogOpen(true);
                        }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                      </Box>
                      <Typography variant="h6">{formatCurrency(stat.currentMarketValue)}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">Mortgage Balance</Typography>
                        <IconButton size="small" onClick={() => {
                          setEditValues({ propertyId: stat.propertyId, currentMarketValue: stat.currentMarketValue || '', currentMortgageBal: stat.currentMortgageBal || '' });
                          setEditDialogOpen(true);
                        }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                      </Box>
                      <Typography variant="h6" color="error">{formatCurrency(stat.currentMortgageBal)}</Typography>
                    </Paper>
                  </Grid>
                  {[
                    { label: 'Total Equity', value: formatCurrency(stat.totalEquity), color: 'success.main' },
                    { label: 'Appreciation', value: formatCurrency(stat.appreciation), color: stat.appreciation >= 0 ? 'success.main' : 'error' },
                  ].map((card) => (
                    <Grid item xs={6} md={3} key={card.label}>
                      <Paper sx={{ p: 2, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                        <Typography variant="h6" color={card.color}>{card.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {/* Returns Breakdown */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Returns Breakdown
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {[
                    { label: 'Appreciation', value: formatCurrency(stat.appreciation), color: stat.appreciation >= 0 ? 'success.main' : 'error' },
                    { label: 'Equity Buildup', value: formatCurrency(stat.equityFromMortgage), color: 'success.main' },
                    { label: 'Net Cash Flow', value: formatCurrency(stat.totalCashFlow), color: stat.totalCashFlow >= 0 ? 'success.main' : 'error' },
                    { label: 'Total Return', value: formatCurrency(stat.totalReturn), color: stat.totalReturn >= 0 ? 'success.main' : 'error', bold: true },
                  ].map((card) => (
                    <Grid item xs={6} md={3} key={card.label}>
                      <Paper sx={{ p: 2, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                        <Typography variant="h6" color={card.color} sx={{ fontWeight: card.bold ? 700 : 400 }}>{card.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {/* ROI Metrics */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  ROI Metrics
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {[
                    { label: 'Total ROI', value: formatPct(stat.totalROI) },
                    { label: 'Annualized ROI', value: formatPct(stat.annualizedROI) },
                    { label: 'Cash-on-Cash', value: formatPct(stat.cashOnCash) },
                    { label: 'Cap Rate', value: `${(stat.capRate || 0).toFixed(1)}%` },
                    { label: 'Equity Multiple', value: `${(stat.equityMultiple || 0).toFixed(2)}x` },
                  ].map((card) => (
                    <Grid item xs={6} md={2.4} key={card.label}>
                      <Paper sx={{ p: 2, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                        <Typography variant="h6" color={parseFloat(card.value) >= 0 ? 'success.main' : 'error'}>{card.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )
          ))}

          {/* Portfolio Tab */}
          {investmentTab === investmentStats.properties.length && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                  { label: 'Total Cash Invested', value: formatCurrency(investmentStats.portfolio.totalCashInvested) },
                  { label: 'Total Market Value', value: formatCurrency(investmentStats.portfolio.totalMarketValue) },
                  { label: 'Total Mortgage Balance', value: formatCurrency(investmentStats.portfolio.totalMortgageBal), color: 'error' },
                  { label: 'Total Equity', value: formatCurrency(investmentStats.portfolio.totalEquity), color: 'success.main', bold: true },
                ].map((card) => (
                  <Grid item xs={6} md={3} key={card.label}>
                    <Paper sx={{ p: 2, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                      <Typography variant="h6" color={card.color} sx={{ fontWeight: card.bold ? 700 : 400 }}>{card.value}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                  { label: 'Total Appreciation', value: formatCurrency(investmentStats.portfolio.totalAppreciation), color: 'success.main' },
                  { label: 'Equity from Mortgage', value: formatCurrency(investmentStats.portfolio.totalEquityFromMortgage), color: 'success.main' },
                  { label: 'Net Cash Flow', value: formatCurrency(investmentStats.portfolio.totalCashFlow), color: investmentStats.portfolio.totalCashFlow >= 0 ? 'success.main' : 'error' },
                  { label: 'Total Return', value: formatCurrency(investmentStats.portfolio.totalReturn), color: investmentStats.portfolio.totalReturn >= 0 ? 'success.main' : 'error', bold: true },
                ].map((card) => (
                  <Grid item xs={6} md={3} key={card.label}>
                    <Paper sx={{ p: 2, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                      <Typography variant="h6" color={card.color} sx={{ fontWeight: card.bold ? 700 : 400 }}>{card.value}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Grid container spacing={2}>
                {[
                  { label: 'Total ROI', value: formatPct(investmentStats.portfolio.totalROI) },
                  { label: 'Equity Multiple', value: `${(investmentStats.portfolio.equityMultiple || 0).toFixed(2)}x` },
                ].map((card) => (
                  <Grid item xs={6} md={3} key={card.label}>
                    <Paper sx={{ p: 2, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                      <Typography variant="h6" color={parseFloat(card.value) >= 0 ? 'success.main' : 'error'}>{card.value}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}

      {/* Edit Market Value / Mortgage Balance Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Update Property Values</DialogTitle>
        <DialogContent>
          <TextField
            label="Current Market Value"
            type="number"
            fullWidth
            margin="normal"
            value={editValues.currentMarketValue}
            onChange={(e) => setEditValues({ ...editValues, currentMarketValue: e.target.value })}
          />
          <TextField
            label="Current Mortgage Balance"
            type="number"
            fullWidth
            margin="normal"
            value={editValues.currentMortgageBal}
            onChange={(e) => setEditValues({ ...editValues, currentMortgageBal: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                const prop = properties.find(p => p.id === editValues.propertyId);
                await axios.put(`${config.apiUrl}/api/properties/${editValues.propertyId}`, {
                  name: prop.name, address: prop.address, type: prop.type, units: prop.units,
                  currentMarketValue: parseFloat(editValues.currentMarketValue),
                  currentMortgageBal: parseFloat(editValues.currentMortgageBal),
                });
                const res = await axios.get(`${config.apiUrl}/api/dashboard/investment-stats`);
                setInvestmentStats(res.data);
                setEditDialogOpen(false);
              } catch (err) {
                console.error('Error updating:', err);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Monthly Payments Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Monthly Payment Totals
        </Typography>
        <Paper sx={{ p: 2 }}>
          {sortedMonths.length > 0 ? (
            <Grid container spacing={2}>
              {sortedMonths.map(([monthYear, amount]) => {
                const [month, year] = monthYear.split('/');
                const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
                return (
                  <Grid item xs={12} sm={6} md={4} key={monthYear}>
                    <Paper
                      sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Typography variant="subtitle1" color="text.secondary">
                        {monthName} {year}
                      </Typography>
                      <Typography variant="h6" color="primary">
                        ${amount.toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No payment data available.
            </Typography>
          )}
        </Paper>
      </Box>

      {/* Monthly Profits Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Monthly Profit/Loss (Click to view details)
        </Typography>
        <Paper sx={{ p: 2 }}>
          {sortedProfitMonths.length > 0 ? (
            <Grid container spacing={2}>
              {sortedProfitMonths.map(([monthYear, amount]) => {
                const [month, year] = monthYear.split('/');
                const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
                const isProfit = amount >= 0;
                return (
                  <Grid item xs={12} sm={6} md={4} key={monthYear}>
                    <Paper
                      sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        bgcolor: 'background.default',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          transform: 'scale(1.02)',
                          transition: 'all 0.2s ease-in-out',
                        },
                      }}
                      onClick={() => handleMonthClick(monthYear)}
                    >
                      <Typography variant="subtitle1" color="text.secondary">
                        {monthName} {year}
                      </Typography>
                      <Typography variant="h6" color={isProfit ? "success.main" : "error"}>
                        ${Math.abs(amount).toFixed(2)}
                        <Typography component="span" variant="body2" color={isProfit ? "success.main" : "error"}>
                          {' '}({isProfit ? 'Profit' : 'Loss'})
                        </Typography>
                      </Typography>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No profit/loss data available.
            </Typography>
          )}
        </Paper>
      </Box>

      {/* Monthly Expenses Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Monthly Expense Totals
        </Typography>
        <Paper sx={{ p: 2 }}>
          {sortedExpenseMonths.length > 0 ? (
            <Grid container spacing={2}>
              {sortedExpenseMonths.map(([monthYear, amount]) => {
                const [month, year] = monthYear.split('/');
                const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
                return (
                  <Grid item xs={12} sm={6} md={4} key={monthYear}>
                    <Paper
                      sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Typography variant="subtitle1" color="text.secondary">
                        {monthName} {year}
                      </Typography>
                      <Typography variant="h6" color="error">
                        ${amount.toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No expense data available.
            </Typography>
          )}
        </Paper>
      </Box>

      {/* Month Details Modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        aria-labelledby="month-details-modal"
        aria-describedby="month-details-description"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: 1000,
          maxHeight: '90vh',
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
          overflow: 'auto',
        }}>
          {selectedMonth && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" component="h2">
                  {(() => {
                    const [month, year] = selectedMonth.split('/');
                    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
                    return `${monthName} ${year} Details`;
                  })()}
                </Typography>
                <Button onClick={handleCloseModal} variant="outlined">
                  Close
                </Button>
              </Box>

              <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
                <Tab label="Payments" />
                <Tab label="Expenses" />
                <Tab label="Summary" />
              </Tabs>

              {tabValue === 0 && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <FormControl sx={{ minWidth: 200 }}>
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
                  </Box>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Tenant</TableCell>
                          <TableCell>Property</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Notes</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getFilteredPayments(getMonthData(selectedMonth).monthPayments).map((payment) => {
                          const tenant = tenants.find(t => t.id === payment.tenantId);
                          const property = properties.find(p => p.id === tenant?.propertyId);
                          return (
                            <TableRow key={payment.id}>
                              <TableCell>
                                {new Date(payment.date).toLocaleDateString('en-US', {
                                  timeZone: 'UTC',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </TableCell>
                              <TableCell>
                                {tenant?.name || 'Unknown'}
                                {tenant?.isArchived && (
                                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                    (Archived)
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>{property?.name || 'Unknown'}</TableCell>
                              <TableCell align="right">${payment.amount}</TableCell>
                              <TableCell>{payment.notes || '-'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {tabValue === 1 && (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Property</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Description</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {getMonthData(selectedMonth).monthExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>
                            {new Date(expense.date).toLocaleDateString('en-US', {
                              timeZone: 'UTC',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell>{properties.find(p => p.id === expense.propertyId)?.name || 'Unknown'}</TableCell>
                          <TableCell>{expense.category}</TableCell>
                          <TableCell align="right">${expense.amount}</TableCell>
                          <TableCell>{expense.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {tabValue === 2 && (
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h6" color="primary">
                          Total Payments
                        </Typography>
                        <Typography variant="h4" color="primary">
                          ${getFilteredPayments(getMonthData(selectedMonth).monthPayments).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h6" color="error">
                          Total Expenses
                        </Typography>
                        <Typography variant="h4" color="error">
                          ${getMonthData(selectedMonth).monthExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h6" color={monthlyProfits[selectedMonth] >= 0 ? "success.main" : "error"}>
                          Net Profit/Loss
                        </Typography>
                        <Typography variant="h4" color={monthlyProfits[selectedMonth] >= 0 ? "success.main" : "error"}>
                          ${Math.abs(monthlyProfits[selectedMonth]).toFixed(2)}
                        </Typography>
                        <Typography variant="body2" color={monthlyProfits[selectedMonth] >= 0 ? "success.main" : "error"}>
                          ({monthlyProfits[selectedMonth] >= 0 ? 'Profit' : 'Loss'})
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </>
          )}
        </Box>
      </Modal>
    </Box>
  );
}

export default Dashboard; 