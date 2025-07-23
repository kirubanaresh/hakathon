// frontend/src/components/AdminPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// --- NEW MUI IMPORTS ---
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper, // For table container background/shadow
  CircularProgress, // For loading indicator
  Alert, // For messages
  FormControl, // For select/label grouping
  InputLabel, // Label for select
  IconButton, // For action buttons (Edit/Delete)
  Dialog, // For the modal pop-up for role editing
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip, // For displaying roles as chips
  OutlinedInput, // <--- ADDED THIS IMPORT FOR MULTIPLE SELECT WITH CHIPS
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';


function AdminPanel() {
  const { user, isAuthenticated, hasRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // State for role editing dialog
  const [showRoleEditDialog, setShowRoleEditDialog] = useState(false);
  const [userToEditRoles, setUserToEditRoles] = useState(null); // User whose roles are being edited
  const [newRoles, setNewRoles] = useState([]); // Roles for editing

  // State for Filters
  const [filters, setFilters] = useState({
    username: '',
    role: '', // Filter by single role
  });

  // State for Sorting
  const [sortBy, setSortBy] = useState('username'); // Default sort field
  const [sortOrder, setSortOrder] = useState('asc'); // Default sort order ('asc' or 'desc')

  const availableRoles = ["user", "viewer", "operator", "supervisor", "admin"]; // Define all possible roles

  const isAdmin = hasRole(['admin']);

  const fetchUsers = useCallback(async () => {
    if (!isAuthenticated() || !isAdmin) {
      setMessage('You do not have administrative privileges to view this page.');
      setLoading(false);
      setUsers([]);
      return;
    }

    setLoading(true);
    setMessage(''); // Clear previous messages before starting new fetch
    try {
      const token = localStorage.getItem('access_token');
      const tokenType = localStorage.getItem('token_type');

      // Construct URL with query parameters
      const queryParams = new URLSearchParams();
      if (filters.username) queryParams.append('username', filters.username);
      if (filters.role) queryParams.append('role', filters.role);

      queryParams.append('sort_by', sortBy);
      queryParams.append('sort_order', sortOrder);

      const url = `http://localhost:8000/users/?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `${tokenType} ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const responseData = await response.json(); // Renamed to avoid confusion with filtered 'data'
        // Check if the response is an object with a 'users' key (common for pagination or wrappers)
        // Otherwise, assume it's a direct array.
        const usersArray = Array.isArray(responseData) ? responseData : (responseData.users || []);

        // Filter out the current logged-in user from the list
        // setUsers(usersArray.filter(u => u.id !== user.id)); // Original line
        setUsers(usersArray); // Temporarily removing filter as discussed for debugging
        setMessage('Users loaded successfully.');
      } else {
        const errorData = await response.json();
        setMessage(`Failed to load users: ${errorData.detail || response.statusText || 'Unknown error'}`);
        console.error('Fetch error:', errorData);
        setUsers([]);
      }
    } catch (error) {
      setMessage(`Network error: ${error.message}. Please check your connection and try again.`);
      console.error('Network error:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAdmin, user, filters, sortBy, sortOrder]);


  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handlers for Filter Inputs
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prevFilters => ({
      ...prevFilters,
      [name]: value
    }));
  };

  // Handlers for Applying/Clearing Filters
  const handleApplyFilters = () => {
    fetchUsers(); // Trigger data re-fetch with current filter state
  };

  const handleClearFilters = () => {
    setFilters({
      username: '',
      role: '',
    });
    setSortBy('username'); // Reset sort to default
    setSortOrder('asc');   // Reset sort to default
    // fetchUsers will be called by useEffect due to filter/sort state changes
  };

  // Handler for Sorting
  const handleSort = (field) => {
    if (sortBy === field) {
      // If already sorting by this field, toggle order
      setSortOrder(prevOrder => (prevOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      // If sorting by a new field, set default order to ascending
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Helper to render sort indicator icon
  const renderSortIndicator = (field) => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: 'middle', ml: 0.5 }} /> : <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: 'middle', ml: 0.5 }} />;
    }
    return null;
  };

  // --- Role Editing Dialog Handlers ---
  const handleEditRolesClick = (userToEdit) => {
    setUserToEditRoles(userToEdit);
    setNewRoles(userToEdit.roles || []); // Pre-fill with current roles
    setShowRoleEditDialog(true);
  };

  const handleCloseRoleEditDialog = () => {
    setShowRoleEditDialog(false);
    setUserToEditRoles(null);
    setNewRoles([]);
  };

  const handleRolesChange = (event) => {
    const { value } = event.target;
    // Ensure value is always an array for multiple select
    setNewRoles(typeof value === 'string' ? value.split(',') : value);
  };

  const handleUpdateRoles = async () => {
    if (!userToEditRoles || !newRoles) {
      setMessage('Error: No user selected or roles provided for update.');
      return;
    }

    setMessage(''); // Clear previous messages
    try {
      const token = localStorage.getItem('access_token');
      const tokenType = localStorage.getItem('token_type');

      const response = await fetch(`http://localhost:8000/users/${userToEditRoles._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `${tokenType} ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roles: newRoles }),
      });

      if (response.ok) {
        setMessage(`Roles for ${userToEditRoles.username} updated successfully.`);
        handleCloseRoleEditDialog();
        fetchUsers(); // Re-fetch users to update table
      } else {
        const errorData = await response.json();
        // More specific error message
        setMessage(`Failed to update roles: ${errorData.detail || response.statusText || 'Unknown error'}`);
        console.error('Update roles error:', errorData);
      }
    } catch (error) {
      setMessage(`Network error during role update: ${error.message}. Please check your connection.`);
      console.error('Network error:', error);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user ${username}? This action cannot be undone.`)) {
      return;
    }
    setMessage(''); // Clear previous messages
    try {
      const token = localStorage.getItem('access_token');
      const tokenType = localStorage.getItem('token_type');
      console.log(userId);
      const response = await fetch(`http://localhost:8000/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `${tokenType} ${token}`,
        },
      });

      if (response.ok) {
        setMessage(`User ${username} deleted successfully.`);
        fetchUsers(); // Re-fetch users to update the list
      } else {
        const errorData = await response.json();
        // More specific error message
        setMessage(`Failed to delete user: ${errorData.detail || response.statusText || 'Unknown error'}`);
        console.error('Delete user error:', errorData);
      }
    } catch (error) {
      setMessage(`Network error during deletion: ${error.message}. Please check your connection.`);
      console.error('Network error:', error);
    }
  };


  return (
    <Box
      sx={{
        p: 0, // No padding on the outermost container
        margin: 0, // No margin on the outermost container
        width: '100%', // Take full width
        minHeight: '100%', // Ensures it fills its parent's height (flex-grow: 1 in App.jsx)
        bgcolor: 'background.default', // Use default background for the page background
      }}
    >
      <Box
        component={Paper} // Use Paper for the content area's background and shadow
        sx={{
          p: 3, // Apply internal padding here for content spacing
          borderRadius: '8px',
          boxShadow: 6, // Slightly more pronounced shadow
          transition: 'box-shadow 0.3s ease-in-out', // Added transition for shadow
          '&:hover': {
            boxShadow: '0 8px 25px rgba(0,0,0,0.15)', // Deeper shadow on hover
          },
          bgcolor: 'background.paper',
          maxWidth: 'lg', // Max width set to Material-UI's 'lg' breakpoint (1200px)
          mx: 'auto', // Center the content horizontally within the full-width outer box
          my: 4, // Add some vertical margin to separate from top/bottom if needed
        }}
      >
        <Typography variant="h4" component="h2" gutterBottom>
          Admin Panel - User Management
        </Typography>

        {/* Message Display */}
        {message && (
          <Alert
            severity={message.includes('Failed') || message.includes('error') ? 'error' : 'success'}
            sx={{ mb: 2 }} // margin-bottom: 16px
          >
            {message}
          </Alert>
        )}

        {/* Authorization Check */}
        {!isAuthenticated() ? (
          <Typography color="error" sx={{ mt: 2 }}>Please log in to view this page.</Typography>
        ) : (
          <> {/* Start of React Fragment for authenticated user content */}
            {!isAdmin && (
              <Typography color="error" sx={{ mt: 2 }}>You do not have administrative privileges to view this page. Only 'admin' role can access.</Typography>
            )}

            {isAdmin && (
              <> {/* Start of React Fragment for admin content */}
                {/* --- Filter & Search Section --- */}
                <Box
                  sx={{
                    bgcolor: '#f9f9f9', // Light background for filter section
                    p: 3, // padding: 24px
                    borderRadius: '8px',
                    mb: 3, // margin-bottom: 24px
                    border: '1px solid #ddd'
                  }}
                >
                  <Typography variant="h6" component="h3" gutterBottom>
                    Filter Users
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',       // On extra-small screens, 1 column
                        sm: 'repeat(2, 1fr)', // On small screens and up, 2 columns
                      },
                      gap: 2, // gap: 16px
                      mb: 2 // margin-bottom: 16px
                    }}
                  >
                    {/* Username Filter */}
                    <TextField
                      label="Username"
                      id="username-filter"
                      name="username"
                      value={filters.username}
                      onChange={handleFilterChange}
                      fullWidth
                      variant="outlined"
                      size="small"
                      placeholder="e.g., john.doe"
                    />
                    {/* Role Filter */}
                    <FormControl fullWidth variant="outlined" size="small">
                      <InputLabel id="role-filter-label">Role</InputLabel>
                      <Select
                        labelId="role-filter-label"
                        id="role-filter"
                        name="role"
                        value={filters.role}
                        onChange={handleFilterChange}
                        label="Role"
                      >
                        <MenuItem value="">All Roles</MenuItem>
                        {availableRoles.map(role => (
                            <MenuItem key={role} value={role}>{role}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button variant="contained" onClick={handleApplyFilters}>Apply Filters</Button>
                      <Button variant="outlined" onClick={handleClearFilters}>Clear Filters</Button>
                  </Box>
                </Box>


                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }}>Loading users...</Typography>
                  </Box>
                ) : users.length > 0 ? (
                  <TableContainer component={Paper} sx={{ mt: 3, boxShadow: 3 }}>
                    <Table sx={{ minWidth: 650 }} aria-label="user list table">
                      <TableHead>
                        <TableRow>
                          {/* Headers with sorting */}
                          {[
                            { id: 'id', label: 'ID' },
                            { id: 'username', label: 'Username' },
                            { id: 'email', label: 'Email' },
                            { id: 'roles', label: 'Roles' },
                            { id: 'is_active', label: 'Active' },
                          ].map((headCell) => (
                            <TableCell
                              key={headCell.id}
                              sortDirection={sortBy === headCell.id ? sortOrder : false}
                              onClick={() => handleSort(headCell.id)}
                              sx={{
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'action.hover', // Uses theme's hover color
                                },
                                whiteSpace: 'nowrap', // Prevent text wrapping
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {headCell.label}
                                {renderSortIndicator(headCell.id)}
                              </Box>
                            </TableCell>
                          ))}
                          <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id} hover>
                            <TableCell>{u.id}</TableCell>
                            <TableCell>{u.username}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                                {u.roles && u.roles.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {u.roles.map(role => (
                                            <Chip key={role} label={role} size="small" color="primary" variant="outlined" />
                                        ))}
                                    </Box>
                                ) : (
                                    '-'
                                )}
                            </TableCell>
                            <TableCell>{u.is_active ? 'Yes' : 'No'}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <IconButton
                                color="primary"
                                size="small"
                                onClick={() => handleEditRolesClick(u)}
                                sx={{ mr: 1 }}
                                aria-label="edit roles"
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                color="error"
                                size="small"
                                disabled={!u.id === user.id}
                                onClick={() => handleDeleteUser(u._id, u.username)}
                                aria-label="delete"
                                 // Disable delete button for current user
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography sx={{ textAlign: 'center', mt: 3, color: 'text.secondary' }}>
                    No other users found.
                  </Typography>
                )}
              </>
            )}
          </>
        )}

        {/* --- Role Editing Dialog --- */}
        {userToEditRoles && (
          <Dialog open={showRoleEditDialog} onClose={handleCloseRoleEditDialog} aria-labelledby="edit-roles-dialog-title">
            <DialogTitle id="edit-roles-dialog-title">Edit Roles for {userToEditRoles.username}</DialogTitle>
            <DialogContent dividers>
              <FormControl fullWidth sx={{ mt: 1, mb: 3 }}>
                <InputLabel id="select-roles-label">Roles</InputLabel>
                <Select
                  labelId="select-roles-label"
                  id="select-roles"
                  multiple
                  value={newRoles}
                  onChange={handleRolesChange}
                  input={<OutlinedInput id="select-multiple-chip" label="Roles" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} />
                      ))}
                    </Box>
                  )}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 224,
                        width: 250,
                      },
                    },
                  }}
                >
                  {availableRoles.map((role) => (
                    <MenuItem
                      key={role}
                      value={role}
                    >
                      {role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseRoleEditDialog} color="secondary">
                Cancel
              </Button>
              <Button onClick={handleUpdateRoles} color="primary" variant="contained">
                Update Roles
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    </Box>
  );
}

export default AdminPanel;