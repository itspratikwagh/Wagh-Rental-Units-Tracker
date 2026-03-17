import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link as RouterLink } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import useMediaQuery from '@mui/material/useMediaQuery';
import MenuIcon from '@mui/icons-material/Menu';
import Dashboard from './components/Dashboard';
import Properties from './components/Properties';
import Tenants from './components/Tenants';
import Payments from './components/Payments';
import Expenses from './components/Expenses';
import Inbox from './components/Inbox';
import Chat from './components/Chat';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const navLinks = [
  { label: 'Dashboard', to: '/' },
  { label: 'Properties', to: '/properties' },
  { label: 'Tenants', to: '/tenants' },
  { label: 'Payments', to: '/payments' },
  { label: 'Expenses', to: '/expenses' },
  { label: 'Inbox', to: '/inbox' },
  { label: 'Chat', to: '/chat' },
];

function Copyright(props) {
  return (
    <Typography variant="body2" color="text.secondary" align="center" {...props}>
      {'Copyright © '}
      <Link color="inherit" href="https://your-website.com/">
        Wagh Rental Units Tracker
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

function App() {
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = (open) => () => {
    setDrawerOpen(open);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <AppBar position="static">
            <Toolbar>
              {isMobile && (
                <IconButton
                  color="inherit"
                  edge="start"
                  onClick={toggleDrawer(true)}
                  sx={{ mr: 2 }}
                  aria-label="open navigation menu"
                >
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Wagh Rental Units Tracker
              </Typography>
              {!isMobile && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {navLinks.map((link) => (
                    <Link key={link.to} component={RouterLink} to={link.to} color="inherit">
                      {link.label}
                    </Link>
                  ))}
                </Box>
              )}
            </Toolbar>
          </AppBar>

          {/* Mobile drawer */}
          <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
            <Box
              sx={{ width: 250 }}
              role="presentation"
              onClick={toggleDrawer(false)}
              onKeyDown={toggleDrawer(false)}
            >
              <Typography variant="h6" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                Navigation
              </Typography>
              <List>
                {navLinks.map((link) => (
                  <ListItem key={link.to} disablePadding>
                    <ListItemButton component={RouterLink} to={link.to}>
                      <ListItemText primary={link.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Drawer>

          <Container component="main" sx={{ mt: 4, mb: 4, flex: 1 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/properties" element={<Properties />} />
                    <Route path="/tenants" element={<Tenants />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/inbox" element={<Inbox />} />
                    <Route path="/chat" element={<Chat />} />
                  </Routes>
                </Paper>
              </Grid>
            </Grid>
          </Container>
          <Box component="footer">
            <Container maxWidth="sm">
              <Copyright />
            </Container>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
