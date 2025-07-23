// frontend/src/components/ProductionDataPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import ProductionForm from './ProductionForm'; // Your custom form component
import { getRecords, putRecords, clearRecords } from '../utils/indexedDB'; // NEW: Import IndexedDB utilities

// --- MUI IMPORTS ---
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
  Dialog, // For confirmation dialog
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
// Icons for sorting
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
// Icons for Edit/Delete (optional, but good for professional look)
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';


function ProductionDataPage() {
  const { user, isAuthenticated, hasRole } = useAuth();
  const [productionRecords, setProductionRecords] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null); // State to hold record being edited
  const [isOffline, setIsOffline] = useState(!navigator.onLine); // NEW: Track online/offline status

  // State for Filters
  const [filters, setFilters] = useState({
    product_name: '',
    machine_id: '',
    operator_id: '',
    quality_status: '',
  });

  // State for Sorting
  const [sortBy, setSortBy] = useState('start_time'); // Default sort field
  const [sortOrder, setSortOrder] = useState('desc'); // Default sort order ('asc' or 'desc')

  // State for delete confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const canAdd = hasRole(['operator', 'supervisor', 'admin']);
  const canEdit = hasRole(['operator', 'supervisor', 'admin']);
  const canDelete = hasRole(['admin']);
  const canView = hasRole(['supervisor', 'admin', 'viewer']); // Operators removed from here
  const canDownload = hasRole(['operator', 'supervisor', 'admin', 'viewer']);

  // NEW: Handle online/offline status changes
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  const fetchProductionRecords = useCallback(async () => {
    if (!isAuthenticated() || !canView) {
      setMessage('You do not have permission to view production data.');
      setLoading(false);
      setProductionRecords([]);
      return;
    }

    setLoading(true);
    setMessage('');
    let fetchedFromNetwork = false;

    try {
      if (!isOffline) { // Only try network fetch if online
        const token = localStorage.getItem('access_token');
        const tokenType = localStorage.getItem('token_type');

        const queryParams = new URLSearchParams();
        if (filters.product_name) queryParams.append('product_name', filters.product_name);
        if (filters.machine_id) queryParams.append('machine_id', filters.machine_id);
        if (filters.operator_id) queryParams.append('operator_id', filters.operator_id);
        if (filters.quality_status) queryParams.append('quality_status', filters.quality_status);

        queryParams.append('sort_by', sortBy);
        queryParams.append('sort_order', sortOrder);

        const url = `http://localhost:8000/production-data/?${queryParams.toString()}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `${tokenType} ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProductionRecords(data);
          setMessage('Production records loaded successfully from network.');
          fetchedFromNetwork = true;
          // NEW: Cache data in IndexedDB
          await putRecords(data);
        } else {
          const errorData = await response.json();
          setMessage(`Failed to load records from network: ${errorData.detail || response.statusText || 'Unknown error'}. Attempting to load from offline cache.`);
          console.error('Network fetch error:', errorData);
          // Fallback to IndexedDB if network fails
          const offlineData = await getRecords();
          setProductionRecords(offlineData);
          if (offlineData.length > 0) {
            setMessage('Production records loaded from offline cache.');
          } else {
            setMessage('No production records found in offline cache.');
          }
        }
      }
    } catch (networkError) {
      setMessage(`Network error: ${networkError.message}. Attempting to load from offline cache.`);
      console.error('Network error during fetch:', networkError);
      // Fallback to IndexedDB on network error
      try {
        const offlineData = await getRecords();
        setProductionRecords(offlineData);
        if (offlineData.length > 0) {
          setMessage('Production records loaded from offline cache.');
        } else {
          setMessage('No production records found in offline cache.');
        }
      } catch (indexedDBError) {
        setMessage(`Failed to load records from offline cache: ${indexedDBError.message}.`);
        console.error('IndexedDB error:', indexedDBError);
        setProductionRecords([]);
      }
    } finally {
      setLoading(false);
      // If we didn't fetch from network (e.g., initially offline), try loading from IndexedDB
      if (!fetchedFromNetwork && isOffline) {
        try {
          const offlineData = await getRecords();
          setProductionRecords(offlineData);
          if (offlineData.length > 0) {
            setMessage('Currently offline. Production records loaded from offline cache.');
          } else {
            setMessage('Currently offline. No production records found in offline cache.');
          }
        } catch (indexedDBError) {
          setMessage(`Currently offline. Failed to load records from offline cache: ${indexedDBError.message}.`);
          console.error('IndexedDB error:', indexedDBError);
          setProductionRecords([]);
        }
      }
    }
  }, [isAuthenticated, canView, filters, sortBy, sortOrder, isOffline]);


  useEffect(() => {
    fetchProductionRecords();
  }, [fetchProductionRecords]);

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
    // Note: Filters are applied only to the network request.
    // Offline data cannot be dynamically filtered without implementing client-side filtering logic.
    if (isOffline) {
      setMessage('Cannot apply filters while offline. Data displayed is from cache.');
      return;
    }
    fetchProductionRecords(); // Trigger data re-fetch with current filter state
  };

  const handleClearFilters = () => {
    setFilters({
      product_name: '',
      machine_id: '',
      operator_id: '',
      quality_status: '',
    });
    setSortBy('start_time'); // Reset sort to default
    setSortOrder('desc');   // Reset sort to default
    if (isOffline) {
      setMessage('Cannot clear filters while offline. Data displayed is from cache. Reconnect to sync.');
      // If offline, re-fetch from IndexedDB to show all cached data (if filters were applied previously)
      fetchProductionRecords();
    } else {
      fetchProductionRecords(); // Trigger data re-fetch with current filter state
    }
  };

  // Handler for Sorting
  const handleSort = (field) => {
    if (isOffline) {
      setMessage('Cannot sort data while offline. Data displayed is from cache.');
      return;
    }
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

  // --- Form Handlers ---
  const handleAddRecordClick = () => {
    if (isOffline) {
      setMessage('Cannot add new records while offline. Please connect to the internet.');
      return;
    }
    setEditingRecord(null); // Clear any previous editing data
    setShowForm(true);
  };

  const handleEditRecordClick = (record) => {
    if (isOffline) {
      setMessage('Cannot edit records while offline. Please connect to the internet.');
      return;
    }
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleSave = async (recordData) => {
    if (isOffline) {
      setMessage('Cannot save records while offline. Changes will not be synchronized.');
      // In a full offline sync, you'd queue this change here.
      // For now, we prevent the network call.
      setShowForm(false);
      setEditingRecord(null);
      return;
    }
    setMessage(''); // Clear previous messages
    try {
      const token = localStorage.getItem('access_token');
      const tokenType = localStorage.getItem('token_type');

      let response;
      if (recordData.id) {
        // Update existing record
        response = await fetch(`http://localhost:8000/production-data/${recordData.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `${tokenType} ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recordData),
        });
      } else {
        // Add new record
        response = await fetch('http://localhost:8000/production-data/', {
          method: 'POST',
          headers: {
            'Authorization': `${tokenType} ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recordData),
        });
      }

      if (response.ok) {
        setMessage(`Record ${recordData.id ? 'updated' : 'added'} successfully!`);
        setShowForm(false); // Close the form
        fetchProductionRecords(); // Refresh the list (will also update IndexedDB)
      } else {
        const errorData = await response.json();
        setMessage(`Operation failed: ${errorData.detail || response.statusText || 'Unknown error'}`);
        console.error('API error:', errorData);
      }
    } catch (error) {
      setMessage(`Network error: ${error.message}. Please check your connection.`);
      console.error('Network error:', error);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingRecord(null);
  };

  // --- Delete Handlers ---
  const handleDeleteClick = (recordId) => {
    if (isOffline) {
      setMessage('Cannot delete records while offline. Please connect to the internet.');
      return;
    }
    setRecordToDelete(recordId);
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    setMessage('');
    setShowConfirmDialog(false);

    try {
      const token = localStorage.getItem('access_token');
      const tokenType = localStorage.getItem('token_type');

      const response = await fetch(`http://localhost:8000/production-data/${recordToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `${tokenType} ${token}`,
        },
      });

      if (response.ok) {
        setMessage('Record deleted successfully.');
        fetchProductionRecords(); // Refresh the list (will also update IndexedDB)
      } else {
        const errorData = await response.json();
        setMessage(`Failed to delete record: ${errorData.detail || response.statusText || 'Unknown error'}`);
        console.error('Delete error:', errorData);
      }
    } catch (error) {
      setMessage(`Network error during deletion: ${error.message}. Please check your connection.`);
      console.error('Network error:', error);
    } finally {
      setRecordToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
    setRecordToDelete(null);
  };

  // --- Download CSV Handler ---
  const handleDownloadCsv = async () => {
    if (isOffline) {
      setMessage('Cannot download CSV while offline. Please connect to the internet to get the latest data.');
      return;
    }
    if (!isAuthenticated() || !canDownload) {
      setMessage('You do not have permission to download data.');
      return;
    }

    setMessage('Preparing CSV download...');
    try {
      const token = localStorage.getItem('access_token');
      const tokenType = localStorage.getItem('token_type');

      const queryParams = new URLSearchParams();
      if (filters.product_name) queryParams.append('product_name', filters.product_name);
      if (filters.machine_id) queryParams.append('machine_id', filters.machine_id);
      if (filters.operator_id) queryParams.append('operator_id', filters.operator_id);
      if (filters.quality_status) queryParams.append('quality_status', filters.quality_status);

      queryParams.append('sort_by', sortBy);
      queryParams.append('sort_order', sortOrder);

      const url = `http://localhost:8000/production-data/download-csv?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `${tokenType} ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `production_data_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setMessage('CSV download started successfully!');
      } else {
        const errorData = await response.json();
        setMessage(`Failed to download CSV: ${errorData.detail || response.statusText || 'Unknown error'}`);
        console.error('Download CSV error:', errorData);
      }
    } catch (error) {
      setMessage(`Network error during CSV download: ${error.message}. Please check your connection.`);
      console.error('Network error:', error);
    }
  };


  if (!isAuthenticated() || !canView) {
    return (
      <Box
        sx={{
          p: 3,
          margin: 0,
          width: '100%',
          minHeight: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: 'background.default', // Keep background for permission denied message
        }}
      >
        <Alert severity="error" sx={{ maxWidth: '600px' }}>
          You do not have sufficient privileges to view all production data.
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 0,
        margin: 0,
        width: '100%',
        minHeight: '100%',
        bgcolor: 'background.default', // Re-added bgcolor for this page
      }}
    >
      <Box
        component={Paper}
        sx={{
          p: 3,
          borderRadius: '8px',
          boxShadow: 6,
          transition: 'box-shadow 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
          },
          bgcolor: 'background.paper', // This Paper component will have a white background
          maxWidth: 'lg',
          mx: 'auto',
          my: 4,
        }}
      >
        <Typography variant="h4" component="h2" gutterBottom>
          Production Data Management
        </Typography>

        {message && (
          <Alert
            severity={message.includes('Failed') || message.includes('error') ? 'error' : 'success'}
            sx={{ mb: 2 }}
          >
            {message}
          </Alert>
        )}
        {isOffline && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You are currently offline. Data is loaded from your local cache and may not be the most recent.
            Actions like adding, editing, or deleting records will not work until you are online.
          </Alert>
        )}

        {/* --- Filter & Search Section --- */}
        <Box
          sx={{
            bgcolor: '#f9f9f9', // This filter box has its own light background
            p: 3,
            borderRadius: '8px',
            mb: 3,
            border: '1px solid #ddd'
          }}
        >
          <Typography variant="h6" component="h3" gutterBottom>
            Filter Records
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: 2,
              mb: 2
            }}
          >
            <TextField
              label="Product Name"
              id="product-name-filter"
              name="product_name"
              value={filters.product_name}
              onChange={handleFilterChange}
              fullWidth
              variant="outlined"
              size="small"
              placeholder="e.g., Widget A"
              disabled={isOffline} // Disable filters when offline
            />
            <TextField
              label="Machine ID"
              id="machine-id-filter"
              name="machine_id"
              value={filters.machine_id}
              onChange={handleFilterChange}
              fullWidth
              variant="outlined"
              size="small"
              placeholder="e.g., Machine-001"
              disabled={isOffline} // Disable filters when offline
            />
            <TextField
              label="Operator ID"
              id="operator-id-filter"
              name="operator_id"
              value={filters.operator_id}
              onChange={handleFilterChange}
              fullWidth
              variant="outlined"
              size="small"
              placeholder="e.g., Op-005"
              disabled={isOffline} // Disable filters when offline
            />
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="quality-status-filter-label">Quality Status</InputLabel>
              <Select
                labelId="quality-status-filter-label"
                id="quality-status-filter"
                name="quality_status"
                value={filters.quality_status}
                onChange={handleFilterChange}
                label="Quality Status"
                disabled={isOffline} // Disable filters when offline
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="Passed">Passed</MenuItem>
                <MenuItem value="Failed">Failed</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button variant="contained" onClick={handleApplyFilters} disabled={isOffline}>Apply Filters</Button>
              <Button variant="outlined" onClick={handleClearFilters} disabled={isOffline}>Clear Filters</Button>
          </Box>
        </Box>

        {/* --- Action Buttons (Add New, Download CSV) --- */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 3 }}>
          {canAdd && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleAddRecordClick}
              disabled={isOffline} // Disable when offline
            >
              Add New Record
            </Button>
          )}
          {canDownload && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCsv}
              disabled={isOffline} // Disable when offline
            >
              Download CSV
            </Button>
          )}
        </Box>

        {/* --- Production Records Table --- */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading records...</Typography>
          </Box>
        ) : productionRecords.length > 0 ? (
          <TableContainer component={Paper} sx={{ mt: 3, boxShadow: 3 }}>
            <Table sx={{ minWidth: 650 }} aria-label="production records table">
              <TableHead>
                <TableRow>
                  {[
                    { id: 'id', label: 'ID' },
                    { id: 'product_name', label: 'Product' },
                    { id: 'machine_id', label: 'Machine' },
                    { id: 'operator_id', label: 'Operator' },
                    { id: 'quantity_produced', label: 'Quantity' },
                    { id: 'start_time', label: 'Start Time' },
                    { id: 'end_time', label: 'End Time' },
                    { id: 'quality_status', label: 'Quality' },
                    { id: 'notes', label: 'Notes' },
                  ].map((headCell) => (
                    <TableCell
                      key={headCell.id}
                      sortDirection={sortBy === headCell.id ? sortOrder : false}
                      onClick={() => handleSort(headCell.id)}
                      sx={{
                        fontWeight: 'bold',
                        cursor: isOffline ? 'not-allowed' : 'pointer', // Change cursor when offline
                        '&:hover': {
                          backgroundColor: isOffline ? 'inherit' : 'action.hover', // No hover effect when offline
                        },
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {headCell.label}
                        {renderSortIndicator(headCell.id)}
                      </Box>
                    </TableCell>
                  ))}
                  {(canEdit || canDelete) && <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {productionRecords.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>{record.id}</TableCell>
                    <TableCell>{record.product_name}</TableCell>
                    <TableCell>{record.machine_id}</TableCell>
                    <TableCell>{record.operator_id}</TableCell>
                    <TableCell>{record.quantity_produced}</TableCell>
                    <TableCell>{new Date(record.start_time).toLocaleString()}</TableCell>
                    <TableCell>{new Date(record.end_time).toLocaleString()}</TableCell>
                    <TableCell>{record.quality_status}</TableCell>
                    <TableCell>{record.notes || '-'}</TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {canEdit && (
                          <IconButton
                            color="primary"
                            size="small"
                            onClick={() => handleEditRecordClick(record)}
                            sx={{ mr: 1 }}
                            aria-label="edit"
                            disabled={isOffline} // Disable when offline
                          >
                            <EditIcon />
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleDeleteClick(record.id)}
                            aria-label="delete"
                            disabled={isOffline} // Disable when offline
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography sx={{ textAlign: 'center', mt: 3, color: 'text.secondary' }}>
            No production data found. {canAdd && "Click 'Add New Record' to start."}
          </Typography>
        )}

        {/* --- Conditionally render the form --- */}
        {showForm && (
          <ProductionForm
            initialData={editingRecord}
            onSave={handleSave}
            onCancel={handleCancelForm}
          />
        )}

        {/* --- Delete Confirmation Dialog --- */}
        <Dialog
          open={showConfirmDialog}
          onClose={handleCancelDelete}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{"Confirm Deletion"}</DialogTitle>
          <DialogContent>
            <Typography id="alert-dialog-description">
              Are you sure you want to delete this record? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelDelete} color="primary" disabled={isOffline}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} color="error" autoFocus disabled={isOffline}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}

export default ProductionDataPage;
