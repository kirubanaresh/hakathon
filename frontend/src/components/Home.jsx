// frontend/src/components/Home.jsx
import React from 'react';
import { Box, Typography, Button, Container, Paper, IconButton } from '@mui/material';
import { Link } from 'react-router-dom';
import { styled } from '@mui/system';
import { useAuth } from '../context/AuthContext'; // Import useAuth

// Import social media icons
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import TelegramIcon from '@mui/icons-material/Telegram';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';


// Styled Link component for MUI Buttons
const StyledLink = styled(Link)(({ theme }) => ({
  textDecoration: 'none',
  color: 'inherit',
  '&:hover': {
    textDecoration: 'none',
  },
}));

function Home() {
  const { isAuthenticated, hasRole } = useAuth(); // NEW: Get hasRole from context

  // Determine if the "Go to Dashboard" button should be shown
  // It should be shown if authenticated AND has any of these roles: supervisor, admin, viewer
  const showDashboardButton = isAuthenticated() && hasRole(['supervisor', 'admin', 'viewer']);

  return (
    // The main container for the Home page. It will not have a background color
    // so the global App.css background image shows through.
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh', // Ensure it takes at least full viewport height
        py: 4, // Vertical padding for overall content
        boxSizing: 'border-box', // Include padding in height calculation
      }}
    >
      {/* Main Welcome Section - this will overlay the background image */}
      <Container
        component={Paper} // Use Paper for styling consistent with theme
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          bgcolor: 'transparent', // Make this section transparent to show background image
          borderRadius: 2,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          transition: 'box-shadow 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          },
          px: 5, // Horizontal padding for content
          py: 3, // Vertical padding for content
          maxWidth: 'md', // Limit width
          mt: 4, // Top margin to push it down a bit from the top of the viewport
          mb: 8, // Bottom margin to separate from scrolling content
        }}
      >
        <Typography variant="h3" component="h1" gutterBottom sx={{ color: 'primary.contrastText', fontWeight: 600, textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}>
          Welcome to the Production Management System
        </Typography>
        <Typography variant="h6" component="p" sx={{ mb: 4, color: '#f0f0f0', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
          Manage your production data efficiently and gain insights into your operations.
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, mt: 3, justifyContent: 'center' }}>
          {/* Conditionally render Login/Register buttons if NOT authenticated */}
          {!isAuthenticated() && (
            <>
              <StyledLink to="/login">
                <Button variant="contained" color="primary" size="large">
                  Login
                </Button>
              </StyledLink>
              <StyledLink to="/register">
                <Button variant="outlined" color="secondary" size="large">
                  Register
                </Button>
              </StyledLink>
            </>
          )}
          {/* Conditionally render "Go to Dashboard" button if authenticated AND has specific roles */}
          {showDashboardButton && (
            <StyledLink to="/dashboard">
              <Button variant="contained" color="primary" size="large">
                Go to Dashboard
              </Button>
            </StyledLink>
          )}
        </Box>
      </Container>

      {/* NEW: Placeholder for content that pushes the contact section below the initial viewport */}
      {/* This invisible box ensures that the content below it starts after the initial screen height */}
      <Box sx={{ height: '50vh', width: '100%' }} /> {/* Adjust height as needed to push content down */}


      {/* Contact Details Section - this will appear below the initial viewport, on its own background */}
      <Box sx={{
        mt: 6,
        px: 5,
        py: 3,
        maxWidth: 'md',
        bgcolor: 'background.paper', // Solid background for clarity
        borderRadius: 2,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%', // Ensure it takes full width of its parent
      }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
          Contact Us
        </Typography>
        <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
          <PhoneIcon sx={{ mr: 1, color: 'primary.dark' }} /> Phone: +1 (123) 456-7890
        </Typography>
        <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
          <EmailIcon sx={{ mr: 1, color: 'primary.dark' }} /> Email: info@prodmgmt.com
        </Typography>
        <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LocationOnIcon sx={{ mr: 1, color: 'primary.dark' }} /> Address: 123 Production Lane, Industrial City, World
        </Typography>
      </Box>

      {/* Social Media Links Section - this will also appear below the initial viewport */}
      <Box sx={{
        mt: 4,
        px: 5,
        py: 3,
        maxWidth: 'md',
        bgcolor: 'background.paper', // Solid background for clarity
        borderRadius: 2,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%', // Ensure it takes full width of its parent
        mb: 4, // Margin at the bottom of the page
      }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
          Follow Us
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
          <IconButton
            component="a"
            href="https://www.instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            sx={{ '&:hover': { color: 'secondary.main' } }}
          >
            <InstagramIcon sx={{ fontSize: 40 }} />
          </IconButton>
          <IconButton
            component="a"
            href="https://www.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            sx={{ '&:hover': { color: 'secondary.main' } }}
          >
            <FacebookIcon sx={{ fontSize: 40 }} />
          </IconButton>
          <IconButton
            component="a"
            href="https://t.me/yourchannel"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            sx={{ '&:hover': { color: 'secondary.main' } }}
          >
            <TelegramIcon sx={{ fontSize: 40 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

export default Home;
