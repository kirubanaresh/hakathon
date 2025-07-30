// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import ProductionAnalyticsPage from './components/ProductionAnalyticsPage'; // Import the new page
import Dashboard from './components/Dashboard';
import ProductionDataPage from './components/ProductionDataPage';
import AdminPanel from './components/AdminPanel';
import OperatorProductionPage from './components/OperatorProductionPage'; // NEW: Import the new operator page
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './components/Home';
import './App.css';
import SupervisorApprovalPage from './components/SupervisorApprovalPage';

// --- NEW MUI IMPORTS ---
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AppBar, Toolbar, Button, Typography, Box, Container } from '@mui/material';
import { styled, keyframes } from '@mui/system';

// --- Define a custom MUI theme ---
const theme = createTheme({
  palette: {
    primary: {
      main: '#2c3e50', // A professional, deep blue-grey
      light: '#4a627a', // Lighter shade for accents/glow
      dark: '#1a2b3c',  // Darker shade for hover
      contrastText: '#ffffff', // White text on primary
    },
    secondary: {
      main: '#1abc9c', // A complementary teal for accents
      light: '#48d6bc',
      dark: '#159c82',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2ecc71', // Bright green for success
      light: '#58d68d',
      dark: '#27ae60',
    },
    error: {
      main: '#e74c3c', // Strong red for errors
      light: '#ec7063',
      dark: '#c0392b',
    },
    background: {
      default: '#ecf0f1', // Very light grey for overall app background
      paper: '#ffffff',   // White background for cards/panels
    },
    text: {
      primary: '#2c3e50', // Dark grey for primary text, high contrast
      secondary: '#7f8c8d', // Medium grey for secondary text
    },
  },
  typography: {
    fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 700 },
    h2: { fontSize: '2rem', fontWeight: 600 },
    h3: { fontSize: '1.75rem', fontWeight: 600 },
    h4: { fontSize: '1.5rem', fontWeight: 500 },
    body1: { fontSize: '1rem', color: '#2c3e50' },
    body2: { fontSize: '0.875rem', color: '#7f8c8d' },
    button: { textTransform: 'none' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'background-color 0.3s ease-in-out, transform 0.1s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'box-shadow 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          minHeight: 64, // Standard AppBar height
        },
      },
    },
  },
});

// --- Keyframes for menu item glow on hover (lighter) ---
const menuGlow = keyframes`
  0% { text-shadow: none; }
  50% { text-shadow: 0 0 5px rgba(255, 255, 255, 0.4); }
  100% { text-shadow: none; }
`;


// --- Styled Link component for MUI Buttons in the Header ---
const HeaderLink = styled(Link)(({ theme }) => ({
  textDecoration: 'none',
  color: 'inherit', // Inherit color from Button
  padding: theme.spacing(2, 3), // Increased padding for larger, more uniform buttons (from 1.5, 2.5)
  borderRadius: theme.shape.borderRadius, // Rounded corners for button-like feel
  // Transition only for transform and box-shadow for pop-up effect
  transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',

  minWidth: '120px', // Set a minimum width for uniform size
  textAlign: 'center', // Center text within the button
  boxShadow: 'none', // Ensure no initial shadow on the link itself

  '& .MuiButton-root': { // Target the Button component inside the Link
    color: theme.palette.primary.contrastText, // Ensure text is white
    padding: 0, // Remove default button padding as Link handles it
    minWidth: 'unset', // Allow button to shrink to content (but HeaderLink sets minWidth)
    width: '100%', // Make button fill the HeaderLink's width
    height: '100%', // Make button fill the HeaderLink's height
    backgroundColor: 'transparent', // Ensure button background is transparent initially

    '&:hover': {
      backgroundColor: 'transparent', // NO background color change on hover
      transform: 'translateY(-4px)', // More pronounced pop-up lift
      boxShadow: '0 4px 10px rgba(0,0,0,0.2)', // Subtle shadow for depth
      // Removed animation: `${menuGlow} 1.5s infinite alternate`, // Removed blinking glow
    },
    '&:active': {
      transform: 'translateY(0)', // Push down on click
      boxShadow: 'none', // No shadow on active
    },
  },
  // Ensure the Typography inside also gets the hover effect
  '& .MuiTypography-root': {
    fontSize: '1.05rem', // Slightly increased font size
    fontWeight: 500, // Slightly bolder font
    transition: 'none', // NO color transition for text
  },
  '&:hover .MuiTypography-root': {
    color: theme.palette.primary.contrastText, // Keep text white (no color change)
    textShadow: '0 0 5px rgba(255, 255, 255, 0.5)', // Subtle, non-blinking text glow
  },
}));


// --- MODIFIED Header Component using MUI ---
const Header = () => {
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  return (
    <AppBar position="static" color="primary" elevation={4}> {/* Added elevation for subtle shadow */}
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: '64px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}> {/* Added gap for spacing */}
          <HeaderLink to="/">
            <Button color="inherit">
              <Typography variant="h6" component="div">
                Home
              </Typography>
            </Button>
          </HeaderLink>

          {/* Dashboard link - only for supervisor, admin, viewer */}
          {isAuthenticated() && hasRole(['supervisor', 'admin', 'viewer']) && (
            <HeaderLink to="/dashboard">
              <Button color="inherit">
                <Typography variant="h6" component="div">
                  Dashboard
                </Typography>
              </Button>
            </HeaderLink>
          )}

          {/* Production Data link - only for supervisor, admin, viewer */}
          {isAuthenticated() && hasRole(['supervisor', 'admin', 'viewer']) && (
            <HeaderLink to="/production-data">
              <Button color="inherit">
                <Typography variant="h6" component="div">
                  All Production Data
                </Typography>
              </Button>
            </HeaderLink>
          )}

          {/* My Production link - ONLY for operator */}
          {isAuthenticated() && hasRole(['operator']) && (
            <HeaderLink to="/my-production">
              <Button color="inherit">
                <Typography variant="h6" component="div">
                  My Production
                </Typography>
              </Button>
            </HeaderLink>
          )}

          {/* Analytics link - for admin, supervisor, viewer */}
          {isAuthenticated() && hasRole(['admin', 'supervisor', 'viewer']) && (
            <HeaderLink to="/analytics">
              <Button color="inherit">
                <Typography variant="h6" component="div">
                  Analytics
                </Typography>
              </Button>
            </HeaderLink>
          )}
          {isAuthenticated() && hasRole(['supervisor']) && (
            <HeaderLink to="/supervisor/approvals">
              <Button color="inherit">Approvals</Button>
            </HeaderLink>
          )}

          {isAuthenticated() && hasRole(['admin']) && (
            <HeaderLink to="/admin-panel">
              <Button color="inherit">
                <Typography variant="h6" component="div">
                  Admin Panel
                </Typography>
              </Button>
            </HeaderLink>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}> {/* Added gap for spacing */}
          {isAuthenticated() ? (
            <>
              <Typography variant="body1" sx={{ mr: 2, color: 'primary.contrastText', fontSize: '0.95rem' }}> {/* Ensure text color is white, slightly smaller font */}
                Welcome, {user?.username} ({user?.roles.join(', ')})
              </Typography>
              <Button variant="contained" color="secondary" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <HeaderLink to="/login">
                <Button color="inherit">
                  <Typography variant="h6" component="div">
                    Login
                  </Typography>
                </Button>
              </HeaderLink>
              <HeaderLink to="/register">
                <Button color="inherit">
                  <Typography variant="h6" component="div">
                    Register
                  </Typography>
                </Button>
              </HeaderLink>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider theme={theme}>
          {/* Main layout container using flexbox for full height */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100vh', // Ensures the app takes at least full viewport height
              // REMOVED: bgcolor: 'background.default', // This was covering the body background
            }}
          >
            <Header />
            {/* Main content area, stretching to fill remaining vertical space */}
            <Box
              component="main" // Use 'main' semantic element
              sx={{
                flexGrow: 1, // Allows this Box to take up remaining space
                height: '100%', // Explicitly set height to 100% of its flex parent
                p: 0, // No padding for this main routes container
                display: 'flex', // Use flexbox for containing individual route components
                justifyContent: 'center', // Center content horizontally
                alignItems: 'stretch', // STRETCH individual route components vertically
              }}
            >
              <Routes>
                {/* Home page route */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/production-data"
                  element={
                    <ProtectedRoute>
                      <ProductionDataPage />
                    </ProtectedRoute>
                  }
                />
                {/* Add the new route for ProductionAnalyticsPage */}
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute>
                      <ProductionAnalyticsPage />
                    </ProtectedRoute>
                  }
                />
                {/* NEW: Add the new route for OperatorProductionPage */}
                <Route
                  path="/my-production"
                  element={
                    <ProtectedRoute>
                      <OperatorProductionPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supervisor/approvals"
                  element={
                    <ProtectedRoute roles={['supervisor']}>
                      <SupervisorApprovalPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin-panel"
                  element={
                    <ProtectedRoute>
                      <AdminPanel />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<h1>404 - Page Not Found</h1>} />
              </Routes>
            </Box>
          </Box>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
