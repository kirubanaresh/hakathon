// frontend/src/components/Register.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation

// --- NEW MUI IMPORTS ---
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  FormControl, // For Select/InputLabel grouping
  InputLabel, // Label for Select
  Select, // For the role dropdown
  MenuItem, // For Select options
  Link as MuiLink // Alias Link to avoid conflict with react-router-dom's Link
} from '@mui/material';
import { styled, keyframes } from '@mui/system'; // For custom animations and styled components


// Define a subtle glow animation for elements
const glow = keyframes`
  0% { box-shadow: 0 0 3px rgba(0, 123, 255, 0.2), 0 0 6px rgba(0, 123, 255, 0.1); } /* Lighter glow */
  50% { box-shadow: 0 0 10px rgba(0, 123, 255, 0.4), 0 0 20px rgba(0, 123, 255, 0.3); } /* Lighter glow */
  100% { box-shadow: 0 0 3px rgba(0, 123, 255, 0.2), 0 0 6px rgba(0, 123, 255, 0.1); } /* Lighter glow */
`;

// Define a more vibrant glow for primary elements (adjusted for lighter effect)
const vibrantGlow = keyframes`
  0% { box-shadow: 0 0 5px rgba(0, 123, 255, 0.4), 0 0 10px rgba(0, 123, 255, 0.3); } /* Lighter vibrant glow */
  50% { box-shadow: 0 0 15px rgba(0, 123, 255, 0.6), 0 0 30px rgba(0, 123, 255, 0.5); } /* Lighter vibrant glow */
  100% { box-shadow: 0 0 5px rgba(0, 123, 255, 0.4), 0 0 10px rgba(0, 123, 255, 0.3); } /* Lighter vibrant glow */
`;


// Define a subtle fade-in animation for the form container
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Styled Paper component for the form container with glow and animation
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3), // Reduced padding
  borderRadius: theme.shape.borderRadius * 2, // More rounded corners
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', // VERY LITE initial shadow (matching Login)
  transition: 'all 0.4s ease-in-out', // Smooth transition for all properties
  animation: `${fadeIn} 0.8s ease-out forwards`, // Apply fade-in animation
  position: 'relative', // Needed for absolute positioning of glow elements if any
  overflow: 'hidden', // Ensures glow doesn't spill out
  maxWidth: '380px', // Reduced width
  width: '90%', // Responsive width
  margin: '50px auto', // Center horizontally with vertical margin
  background: 'linear-gradient(145deg, #ffffff, #f0f0f0)', // Subtle gradient background for depth

  '&:hover': {
    boxShadow: `0 0 6px rgba(0, 123, 255, 0.3), 0 0 10px rgba(0, 123, 255, 0.2)`, // Lighter glow on hover (matching Login)
    transform: 'translateY(-2px)', // Slightly reduced lift effect
    animation: `${vibrantGlow} 1.5s infinite alternate`, // Apply vibrant glow animation on hover
  },

  // Optional: Add a pseudo-element for a more intense, subtle background glow
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    background: `radial-gradient(circle at center, ${theme.palette.primary.light} 0%, transparent 70%)`,
    opacity: 0,
    transition: 'opacity 0.5s ease-in-out',
    zIndex: -1,
  },
  '&:hover::before': {
    opacity: 0.05, // FURTHER REDUCED background glow on hover (matching Login)
  },
}));

// Styled Button with glowing effect on hover
const GlowButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(3), // Space above button
  padding: theme.spacing(1.2, 2.5), // Adjusted padding for button
  fontSize: '1rem', // Adjusted font size
  fontWeight: 600,
  borderRadius: theme.shape.borderRadius * 1.5, // Rounded button
  // CLASSIC BLUE GRADIENT (matching Login)
  background: `linear-gradient(45deg, #1976D2 30%, #2196F3 90%)`, // Classic Blue gradient
  boxShadow: `0 1px 2px 0px rgba(25, 118, 210, .1)`, // REDUCED initial shadow for blue (matching Login)
  transition: 'all 0.3s ease-in-out', // Smooth transition

  '&:hover': {
    // DARKER CLASSIC BLUE GRADIENT ON HOVER (matching Login)
    background: `linear-gradient(45deg, #1565C0 30%, #1976D2 90%)`, // Darker classic blue gradient on hover
    boxShadow: `0 1px 3px 0px rgba(25, 118, 210, .2)`, // REDUCED Stronger shadow for blue on hover (matching Login)
    transform: 'translateY(-2px)', // Slight lift
    animation: `${vibrantGlow} 1.5s infinite alternate`, // Apply vibrant glow animation on hover
  },
  '&:active': {
    transform: 'translateY(0)', // Push down on click
    boxShadow: `0 0px 1px 0px rgba(25, 118, 210, .05)`, // Very light shadow on active (matching Login)
  },
}));


function Register({ onRegisterSuccess, switchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('operator');
  const [message, setMessage] = useState(null); // Use object for message type and text
  const [loading, setLoading] = useState(false); // Loading state for button
  const navigate = useNavigate(); // Use useNavigate hook

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null); // Clear previous messages

    try {
      const response = await fetch('http://localhost:8000/users/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password,
          email: email,
          roles: [selectedRole],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: 'success', text: 'Registration successful! Please log in.' });
        console.log('Registration successful:', data);
        setUsername('');
        setPassword('');
        setEmail('');
        setSelectedRole('operator');
        if (onRegisterSuccess) {
            onRegisterSuccess();
        }
        // Optionally navigate to login after successful registration
        navigate('/login');
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: `Registration failed: ${errorData.detail || 'Unknown error'}` });
        console.error('Registration error:', errorData);
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Network error: ${error.message}. Please check your connection.` });
      console.error('Network error during registration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToLogin = () => {
    if (switchToLogin) {
      switchToLogin(); // Use the prop if provided (for parent component control)
    } else {
      navigate('/login'); // Fallback to navigate if no prop
    }
  };

  const availableRoles = ["operator", "supervisor", "admin", "viewer"]; // Define available roles

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 64px)', // Adjust for header height if present
        bgcolor: 'background.default', // Use theme's default background
        py: 4, // Vertical padding
      }}
    >
      <StyledPaper elevation={12}> {/* Use the styled Paper component */}
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Register New User
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 3 }}>
          Create your account
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            variant="outlined"
            fullWidth
            margin="normal"
            id="reg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 4px rgba(0, 123, 255, 0.3)`, // FURTHER REDUCED glow on focus (matching Login)
                },
              },
            }}
          />
          <TextField
            label="Password"
            variant="outlined"
            fullWidth
            margin="normal"
            type="password"
            id="reg-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 4px rgba(0, 123, 255, 0.3)`, // FURTHER REDUCED glow on focus (matching Login)
                },
              },
            }}
          />
          <TextField
            label="Email"
            variant="outlined"
            fullWidth
            margin="normal"
            type="email"
            id="reg-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 4px rgba(0, 123, 255, 0.3)`, // FURTHER REDUCED glow on focus (matching Login)
                },
              },
            }}
          />
          <FormControl fullWidth margin="normal" variant="outlined">
            <InputLabel id="reg-role-label">Role</InputLabel>
            <Select
              labelId="reg-role-label"
              id="reg-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              label="Role"
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                  '&:hover fieldset': { borderColor: 'primary.main' },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.dark',
                    boxShadow: `0 0 4px rgba(0, 123, 255, 0.3)`, // FURTHER REDUCED glow on focus (matching Login)
                  },
                },
              }}
            >
              {availableRoles.map((role) => (
                <MenuItem key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)} {/* Capitalize first letter */}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <GlowButton
            type="submit"
            variant="contained"
            color="primary" // Changed to primary for classic blue (matching Login)
            fullWidth
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
          </GlowButton>
        </form>

        {message && (
          <Alert severity={message.type} sx={{ mt: 3, width: '100%' }}>
            {message.text}
          </Alert>
        )}

        <Typography variant="body2" align="center" sx={{ mt: 3, color: 'text.secondary' }}>
          Already have an account?{' '}
          <MuiLink
            component="button" // Render as a button for semantic correctness
            onClick={handleSwitchToLogin}
            sx={{
              color: 'primary.main',
              fontWeight: 'bold',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.dark',
              },
              border: 'none', // Remove default button border
              background: 'none', // Remove default button background
              cursor: 'pointer',
              padding: 0, // Remove default button padding
              fontSize: 'inherit', // Inherit font size
            }}
          >
            Log in here
          </MuiLink>
        </Typography>
      </StyledPaper>
    </Box>
  );
}

export default Register;
