// frontend/src/components/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

// --- NEW MUI IMPORTS ---
import {
  Box,
  Typography,
  Paper,
  Alert,
  Grid, // For responsive layout
  CircularProgress, // For loading indicators
  Button, // For "View Details" buttons
} from '@mui/material';
import { styled, keyframes, useTheme } from '@mui/system'; // Import useTheme

// Icons (optional, but good for visual appeal)
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import ProductionQuantityLimitsIcon from '@mui/icons-material/ProductionQuantityLimits';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import EngineeringIcon from '@mui/icons-material/Engineering';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InsightsIcon from '@mui/icons-material/Insights'; // For overview/summary sections
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'; // Corrected import path for the icon


// Keyframes for subtle background gradient animation
const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// Keyframes for a subtle card hover effect
const cardHover = keyframes`
  from { transform: translateY(0); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
  to { transform: translateY(-5px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }
`;

// Keyframes for a fade-in effect for sections
const sectionFadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Keyframes for a subtle icon bounce effect
const iconBounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
`;

// Styled Paper component for dashboard cards/sections
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2, // More rounded corners
  boxShadow: theme.shadows[4], // Initial subtle shadow
  transition: 'all 0.3s ease-in-out, border-color 0.3s ease-in-out', // Added border-color to transition
  background: theme.palette.background.paper, // Use theme's paper background
  border: '1px solid transparent', // Initial transparent border
  height: '100%', // Ensure cards in a grid have equal height
  display: 'flex', // Use flexbox for vertical alignment
  flexDirection: 'column', // Stack content vertically
  justifyContent: 'space-between', // Push footer to bottom

  '&:hover': {
    animation: `${cardHover} 0.3s forwards`, // Apply hover animation
    borderColor: theme.palette.primary.main, // Highlight border on hover
    background: theme.palette.action.hover, // Subtle background change on hover
  },
  // Reset animation on mouse out
  '&:not(:hover)': {
    animation: `${cardHover} 0.3s reverse forwards`,
  },
}));

// Styled Box for the main dashboard container with animated background
const DashboardContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  // Animated background gradient
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.secondary.light} 50%, ${theme.palette.primary.light} 100%)`,
  backgroundSize: '200% 200%',
  animation: `${gradientShift} 15s ease infinite alternate`,
  color: theme.palette.text.primary, // Ensure text is readable on gradient background
}));

// Styled Link for better visual feedback (used for navigation buttons)
const StyledLink = styled(Link)(({ theme }) => ({
  textDecoration: 'none',
  display: 'block', // Make it a block element to fill space and apply padding
  padding: theme.spacing(1.5, 2), // Add padding
  borderRadius: theme.shape.borderRadius, // Rounded corners
  background: theme.palette.primary.main, // Solid background for button-like appearance
  color: theme.palette.primary.contrastText, // White text on primary background
  fontWeight: 'bold',
  textAlign: 'center',
  transition: 'all 0.3s ease-in-out', // Smooth transition for all properties

  '&:hover': {
    background: theme.palette.primary.dark, // Darker background on hover
    textDecoration: 'none', // Ensure no underline on hover
    transform: 'translateY(-1px)', // Slight lift on hover
    boxShadow: theme.shadows[3], // Subtle shadow on hover
  },
  '&:active': {
    transform: 'translateY(0)', // Push down on click
  },
}));


function Dashboard() {
  const { user, isAuthenticated, hasRole } = useAuth();

  // Check if user has any role that can view analytics
  const canViewAnalytics = hasRole(['operator', 'supervisor', 'admin', 'viewer']);

  return (
    <DashboardContainer>
      <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 4, fontWeight: 'bold', color: 'primary.dark', animation: `${sectionFadeIn} 0.8s ease-out forwards` }}>
        <DashboardIcon sx={{ mr: 2, fontSize: 'inherit', verticalAlign: 'middle' }} />
        Dashboard Overview
      </Typography>

      {!isAuthenticated() && (
        <Alert severity="info" sx={{ width: '100%', maxWidth: '800px', mb: 3 }}>
          Please log in to view the dashboard features.
        </Alert>
      )}

      {isAuthenticated() && user ? (
        <Grid
          container
          spacing={4}
          sx={{
            maxWidth: '1400px',
            width: '100%',
            display: 'flex', // Ensure flex container for alignment
            alignItems: 'stretch', // Make grid items stretch to equal height
            justifyContent: 'center', // Center items if they don't fill the row
          }}
        >
          {/* Welcome Card */}
          <Grid item xs={12} sm={6} md={3} sx={{ animation: `${sectionFadeIn} 0.8s ease-out forwards 0.2s` }}>
            <StyledPaper elevation={8}>
              <Box>
                <Typography variant="h5" gutterBottom sx={{ color: 'secondary.main', mb: 2 }}>
                  Welcome, {user.username}!
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Roles: <Box component="span" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{user.roles ? user.roles.join(', ') : 'None'}</Box>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Explore permissions and manage operations.
                </Typography>
              </Box>
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                 <Button
                    component={StyledLink}
                    to="/dashboard"
                    variant="contained"
                    color="primary"
                    endIcon={<ArrowForwardIcon />}
                    sx={{ width: '100%' }}
                 >
                    View Profile
                 </Button>
              </Box>
            </StyledPaper>
          </Grid>

          {/* Quick Links Card (Production Data Management) */}
          {hasRole(['operator', 'supervisor', 'admin', 'viewer']) && (
            <Grid item xs={12} sm={6} md={3} sx={{ animation: `${sectionFadeIn} 0.8s ease-out forwards 0.4s` }}>
              <StyledPaper elevation={8}>
                <Box>
                  <Typography variant="h5" gutterBottom sx={{ color: 'secondary.main', mb: 2 }}>
                    <ProductionQuantityLimitsIcon sx={{ mr: 1, verticalAlign: 'middle', '&:hover': { animation: `${iconBounce} 0.5s infinite alternate` } }} />
                    Production Data
                  </Typography>
                  <Typography variant="body1">
                    Manage individual production records.
                  </Typography>
                </Box>
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                  <Button
                    component={StyledLink}
                    to="/production-data"
                    variant="contained"
                    color="primary"
                    endIcon={<ArrowForwardIcon />}
                    sx={{ width: '100%' }}
                  >
                    Go to Production Data
                  </Button>
                </Box>
              </StyledPaper>
            </Grid>
          )}

          {/* Admin Panel Link */}
          {hasRole(['admin']) && (
            <Grid item xs={12} sm={6} md={3} sx={{ animation: `${sectionFadeIn} 0.8s ease-out forwards 0.6s` }}>
              <StyledPaper elevation={8}>
                <Box>
                  <Typography variant="h5" gutterBottom sx={{ color: 'secondary.main', mb: 2 }}>
                    <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle', '&:hover': { animation: `${iconBounce} 0.5s infinite alternate` } }} />
                    Admin Panel
                  </Typography>
                  <Typography variant="body1">
                    Manage users and settings.
                  </Typography>
                </Box>
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                  <Button
                    component={StyledLink}
                    to="/admin-panel"
                    variant="contained"
                    color="primary"
                    endIcon={<ArrowForwardIcon />}
                    sx={{ width: '100%' }}
                  >
                    Manage Users & Settings
                  </Button>
                </Box>
              </StyledPaper>
            </Grid>
          )}

          {/* New Card for Production Analytics */}
          {canViewAnalytics && (
            <Grid item xs={12} sm={6} md={3} sx={{ animation: `${sectionFadeIn} 0.8s ease-out forwards 0.8s` }}>
              <StyledPaper elevation={8}>
                <Box>
                  <Typography variant="h5" gutterBottom sx={{ color: 'secondary.main', mb: 2 }}>
                    <InsightsIcon sx={{ mr: 1, verticalAlign: 'middle', '&:hover': { animation: `${iconBounce} 0.5s infinite alternate` } }} />
                    Production Analytics
                  </Typography>
                  <Typography variant="body1">
                    View charts and summaries of production data.
                  </Typography>
                </Box>
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                  <Button
                    component={StyledLink}
                    to="/analytics"
                    variant="contained"
                    color="primary"
                    endIcon={<ArrowForwardIcon />}
                    sx={{ width: '100%' }}
                  >
                    View Analytics Dashboard
                  </Button>
                </Box>
              </StyledPaper>
            </Grid>
          )}

        </Grid>
      ) : (
        <Alert severity="warning" sx={{ width: '100%', maxWidth: '800px', mt: 3 }}>
          <Typography>Please log in to access the dashboard features.</Typography>
        </Alert>
      )}
    </DashboardContainer>
  );
}

export default Dashboard;
