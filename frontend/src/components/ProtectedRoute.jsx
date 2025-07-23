// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated()) {
    // If not authenticated, redirect to the login page
    return <Navigate to="/login" replace />;
  }

  return children; // If authenticated, render the children components (e.g., Dashboard)
}

export default ProtectedRoute;