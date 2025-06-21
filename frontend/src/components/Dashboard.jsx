import { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import axios from 'axios';

function Dashboard() {
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propertiesRes, tenantsRes, paymentsRes, expensesRes] = await Promise.all([
          axios.get('http://localhost:3005/api/properties'),
          axios.get('http://localhost:3005/api/tenants'),
          axios.get('http://localhost:3005/api/payments'),
          axios.get('http://localhost:3005/api/expenses')
        ]);
        setProperties(propertiesRes.data);
        setTenants(tenantsRes.data);
        setPayments(paymentsRes.data);
        setExpenses(expensesRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalMonthlyRent = tenants.reduce((sum, tenant) => sum + tenant.rentAmount, 0);
  const totalProperties = properties.length;
  const totalTenants = tenants.length;
  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Calculate monthly payment totals
  const monthlyPayments = payments.reduce((acc, payment) => {
    const date = new Date(payment.date);
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
    acc[monthYear] = (acc[monthYear] || 0) + payment.amount;
    return acc;
  }, {});

  // Calculate monthly expense totals
  const monthlyExpenses = expenses.reduce((acc, expense) => {
    const date = new Date(expense.date);
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
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
      </Grid>

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
          Monthly Profit/Loss
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
                      }}
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
    </Box>
  );
}

export default Dashboard; 