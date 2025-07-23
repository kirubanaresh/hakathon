// frontend/src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, Alert, Typography, CircularProgress } from '@mui/material'; // Added CircularProgress for loading state

/**
 * A private route component that checks user authentication and roles.
 * If the user is not authenticated, they are redirected to the login page.
 * If the user is authenticated but does not have the required role(s),
 * they will see a permission denied message.
 *
 * @param {object} props - The component props.
 * @param {Array<string>} props.roles - An array of roles that are allowed to access this route.
 * @param {React.ReactNode} props.children - The child components to render if access is granted.
 */
function PrivateRoute({ roles, children }) {
  const { isAuthenticated, hasRole, loading } = useAuth(); // Assuming useAuth provides a loading state

  // If authentication status is still loading, show a loading spinner
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress size={60} sx={{ color: 'primary.main' }} />
        <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>Loading authentication...</Typography>
      </Box>
    );
  }

  // Check if the user is authenticated
  if (!isAuthenticated()) {
    // If not authenticated, redirect to the login page
    return <Navigate to="/login" replace />;
  }

  // Check if specific roles are required and if the user has at least one of them
  if (roles && roles.length > 0 && !hasRole(roles)) {
    // If authenticated but doesn't have the required role, show a permission denied message
    return (
      <Box
        sx={{
          p: 3,
          margin: 0,
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Alert severity="error" sx={{ maxWidth: '600px' }}>
          You do not have sufficient privileges to access this page.
        </Alert>
      </Box>
    );
  }

  // If authenticated and has the required role(s), render the children components
  return children;
}

export default PrivateRoute;
