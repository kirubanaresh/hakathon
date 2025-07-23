// frontend/src/components/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// --- NEW MUI IMPORTS ---
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Link as MuiLink
} from '@mui/material';
import { styled, keyframes } from '@mui/system';


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

// Animation for shrinking and moving to the side
const shrinkAndMove = keyframes`
  0% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  70% {
    opacity: 0;
    transform: translateX(150%) scale(0.5); /* Move to right and shrink */
  }
  100% {
    opacity: 0;
    transform: translateX(150%) scale(0.5);
    display: none; /* Hide element after animation */
  }
`;

// Styled Paper component for the form container with glow and animation
const StyledPaper = styled(Paper)(({ theme, shrink }) => ({ // Added 'shrink' prop
  padding: theme.spacing(3), // Reduced padding
  borderRadius: theme.shape.borderRadius * 2, // More rounded corners
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', // VERY LITE initial shadow
  transition: 'all 0.4s ease-in-out', // Smooth transition for all properties
  animation: `${fadeIn} 0.8s ease-out forwards ${shrink ? `, ${shrinkAndMove} 0.7s forwards 0.3s` : ''}`, // Apply shrink animation if 'shrink' prop is true
  position: 'relative', // Needed for absolute positioning of glow elements if any
  overflow: 'hidden', // Ensures glow doesn't spill out
  maxWidth: '380px', // Reduced width
  width: '90%', // Responsive width
  margin: '50px auto', // Center horizontally with vertical margin
  background: 'linear-gradient(145deg, #ffffff, #f0f0f0)', // Subtle gradient background for depth
  // Ensure the element is not hidden by default when shrink is false
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',

  '&:hover': {
    boxShadow: `0 0 6px rgba(0, 123, 255, 0.3), 0 0 10px rgba(0, 123, 255, 0.2)`, // Lighter glow on hover
    transform: 'translateY(-2px)', // Slightly reduced lift effect
    animation: `${shrink ? '' : vibrantGlow} 1.5s infinite alternate`, // Apply vibrant glow animation on hover, only if not shrinking
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
    opacity: 0.05, // FURTHER REDUCED background glow on hover
  },
}));

// Styled Button with glowing effect on hover
const GlowButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(3), // Space above button
  padding: theme.spacing(1.2, 2.5), // Adjusted padding for button
  fontSize: '1rem', // Adjusted font size
  fontWeight: 600,
  borderRadius: theme.shape.borderRadius * 1.5, // Rounded button
  // CLASSIC BLUE GRADIENT
  background: `linear-gradient(45deg, #1976D2 30%, #2196F3 90%)`, // Classic Blue gradient
  boxShadow: `0 1px 2px 0px rgba(25, 118, 210, .1)`, // REDUCED initial shadow for blue
  transition: 'all 0.3s ease-in-out', // Smooth transition

  '&:hover': {
    // DARKER CLASSIC BLUE GRADIENT ON HOVER
    background: `linear-gradient(45deg, #1565C0 30%, #1976D2 90%)`, // Darker classic blue gradient on hover
    boxShadow: `0 1px 3px 0px rgba(25, 118, 210, .2)`, // REDUCED Stronger shadow for blue on hover
    transform: 'translateY(-2px)', // Slight lift
    animation: `${vibrantGlow} 1.5s infinite alternate`, // Apply vibrant glow animation on hover
  },
  '&:active': {
    transform: 'translateY(0)', // Push down on click
    boxShadow: `0 0px 1px 0px rgba(25, 118, 210, .05)`, // Very light shadow on active
  },
}));


function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(null); // Use object for message type and text
  const [loading, setLoading] = useState(false); // Loading state for button
  const [isLoggedIn, setIsLoggedIn] = useState(false); // State to trigger animation
  const { login } = useAuth();
  const navigate = useNavigate(); // Use useNavigate hook

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null); // Clear previous messages

    try {
      const response = await fetch('http://localhost:8000/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: username,
          password: password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('token_type', data.token_type);

        // --- IMPORTANT: Fetch user details for roles and pass to context ---
        const userDetailsResponse = await fetch('http://localhost:8000/auth/me', {
            method: 'GET',
            headers: {
                'Authorization': `${data.token_type} ${data.access_token}`
            }
        });

        if (userDetailsResponse.ok) {
            const userDetails = await userDetailsResponse.json();
            login({ id: userDetails.id, username: userDetails.username, roles: userDetails.roles }); // Pass user info to context
            setMessage({ type: 'success', text: 'Login successful!' });
            setIsLoggedIn(true); // Trigger the shrink and move animation

            // --- NEW: Role-based redirection logic ---
            let redirectPath = '/'; // Default fallback

            if (userDetails.roles.includes('admin') || userDetails.roles.includes('supervisor') || userDetails.roles.includes('viewer')) {
                redirectPath = '/production-data';
            } else if (userDetails.roles.includes('operator')) {
                redirectPath = '/my-production';
            }

            // Delay navigation until the animation completes (0.7s + 0.3s delay = 1s)
            setTimeout(() => {
                navigate(redirectPath); // Redirect to the determined path
            }, 1000); // Match animation duration + delay
        } else {
            console.error('Failed to fetch user details after login.');
            setMessage({ type: 'warning', text: 'Login successful, but failed to fetch user details. Functionality might be limited.' });
            login({ username: username, roles: [] }); // Login with minimal info
            setIsLoggedIn(true); // Trigger animation even with warning
            setTimeout(() => {
                navigate('/production-data'); // Fallback redirect even with warning
            }, 1000); // Match animation duration + delay
        }

      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: `Login failed: ${errorData.detail || 'Unknown error'}` });
        console.error('Login error:', errorData);
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Network error: ${error.message}. Please check your connection.` });
      console.error('Network error during login:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToRegister = () => {
    navigate('/register'); // Navigate to register page
  };

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
      {/* Pass the isLoggedIn state as a prop to StyledPaper */}
      <StyledPaper elevation={12} shrink={isLoggedIn}>
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Welcome Back!
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 3 }}>
          Please log in to your account
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            variant="outlined"
            fullWidth
            margin="normal"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 4px rgba(0, 123, 255, 0.3)`, // FURTHER REDUCED glow on focus
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
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 4px rgba(0, 123, 255, 0.3)`, // FURTHER REDUCED glow on focus
                },
              },
            }}
          />

          <GlowButton
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
          </GlowButton>
        </form>

        {message && (
          <Alert severity={message.type} sx={{ mt: 3, width: '100%' }}>
            {message.text}
          </Alert>
        )}

        <Typography variant="body2" align="center" sx={{ mt: 3, color: 'text.secondary' }}>
          Don't have an account?{' '}
          <MuiLink
            component="button" // Render as a button for semantic correctness
            onClick={handleSwitchToRegister}
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
            Register here
          </MuiLink>
        </Typography>
      </StyledPaper>
    </Box>
  );
}

export default Login;
