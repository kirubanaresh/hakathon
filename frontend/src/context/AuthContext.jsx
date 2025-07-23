// frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Stores { username, roles }
  const navigate = useNavigate();

  useEffect(() => {
    // On component mount, try to load user from localStorage
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      // In a real app, you'd decode the token or make an API call to validate
      // For simplicity, we'll just assume token existence means logged in for now
      // and load roles/username from a separate storage or decode the token (more advanced)
      // For now, let's just mark as logged in. We'll fetch user info later.
      // Or even better, store user info alongside the token during login.
      const storedUser = localStorage.getItem('user_info'); // e.g., JSON.stringify({ username, roles })
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        // Fallback: If token exists but user info doesn't, maybe force logout or fetch user info
        // For now, let's just consider them logged in minimally
        setUser({ username: 'Logged In User', roles: [] });
      }
    }
  }, []);

  const login = (userData) => { // userData should contain { username, roles }
    setUser(userData);
    localStorage.setItem('user_info', JSON.stringify(userData));
    // Token is stored in Login.jsx
    navigate('/dashboard'); // Navigate to dashboard after login
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('user_info');
    navigate('/login'); // Navigate back to login page
  };

  const isAuthenticated = () => {
    return !!user; // Returns true if user is not null
  };

  const hasRole = (requiredRoles) => {
    if (!user || !user.roles) return false;
    // Check if the user has at least one of the required roles
    return requiredRoles.some(role => user.roles.includes(role));
  };


  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};