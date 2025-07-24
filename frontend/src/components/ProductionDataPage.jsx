// src/components/ProductionDataPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import ProductionForm from './ProductionForm';
import { getRecords, putRecords } from '../utils/indexedDB';
import { putOfflineAddition, getOfflineAdditions, removeOfflineAddition } from '../utils/offlineAdditions';

// MUI Imports
import {
  Box, Typography, Button, TextField, Select, MenuItem, TableContainer,
  Table, TableHead, TableBody, TableRow, TableCell, Paper,
  CircularProgress, Alert, FormControl, InputLabel, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';

import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BusinessIcon from '@mui/icons-material/Business';

function ProductionDataPage() {
  const { user, isAuthenticated, hasRole } = useAuth();

  const [productionRecords, setProductionRecords] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [filters, setFilters] = useState({
    product_name: '',
    machine_id: '',
    quality_status: '',
  });

  const [sortBy, setSortBy] = useState('start_time');
  const [sortOrder, setSortOrder] = useState('desc');

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const canViewThisPage = isAuthenticated() && hasRole(['operator', 'supervisor', 'admin', 'admin']); // Adjust roles as per your app
  const canAddRecord = isAuthenticated() && hasRole(['operator', 'supervisor', 'admin']);
  const canEditAny = hasRole(['supervisor', 'admin']);
  const canDeleteAny = hasRole(['admin']);
  const isCurrentUserOperator = hasRole(['operator']);

  // Listen to online/offline status changes
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

  // Sync offline additions when connection restored
  useEffect(() => {
    if (!isOffline) {
      syncOfflineAdditions();
    }
  }, [isOffline]);

  // Sync offline additions to backend
  const syncOfflineAdditions = async () => {
    try {
      const offlineEntries = await getOfflineAdditions();
      if (offlineEntries.length === 0) return;

      const token = localStorage.getItem('access_token');
      const tokenType = localStorage.getItem('token_type');
      let syncedAny = false;

      for (const entry of offlineEntries) {
        try {
          const payload = { ...entry };
          // Remove local keys not needed for backend
          delete payload.local_id;
          delete payload.synced;
          delete payload.created_at;

          // Assign operator_id if needed
          if (!payload.operator_id && isCurrentUserOperator && user?.username) {
            payload.operator_id = user.username;
          }

          const response = await fetch('http://localhost:8000/production-data/', {
            method: 'POST',
            headers: {
              'Authorization': `${tokenType} ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            await removeOfflineAddition(entry.local_id);
            syncedAny = true;
          }
        } catch (error) {
          // Skip, retry next time
          console.error('Offline sync error:', error);
        }
      }

      if (syncedAny) {
        setMessage('Offline records synced.');
        fetchProductionRecords();
      }
    } catch (error) {
      console.error('Error syncing offline additions:', error);
    }
  };

  // Fetch production records from backend or cache
  const fetchProductionRecords = useCallback(async () => {
    if (!canViewThisPage) {
      setMessage('Insufficient permissions to view this page.');
      setProductionRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (!isOffline) {
        const token = localStorage.getItem('access_token');
        const tokenType = localStorage.getItem('token_type');

        const params = new URLSearchParams();
        if (filters.product_name) params.append('product_name', filters.product_name);
        if (filters.machine_id) params.append('machine_id', filters.machine_id);
        if (filters.quality_status) params.append('quality_status', filters.quality_status);
        if (isCurrentUserOperator && user?.username) {
          params.append('operator_id', user.username);
        }
        params.append('sort_by', sortBy);
        params.append('sort_order', sortOrder);

        const response = await fetch(`http://localhost:8000/production-data/?${params.toString()}`, {
          headers: {
            'Authorization': `${tokenType} ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProductionRecords(data);
          setMessage('Production data loaded successfully.');
          await putRecords(data);
        } else {
          const errorData = await response.json();
          setMessage(
            `Failed to load data from network: ${errorData.detail || response.statusText || 'Unknown error'}. Showing cached data.`
          );
          const cachedData = await getRecords();
          const filteredCachedData = isCurrentUserOperator && user?.username
            ? cachedData.filter(d => d.operator_id === user.username)
            : cachedData;
          setProductionRecords(filteredCachedData);
        }
      } else {
        // offline mode: load cached data
        const cachedData = await getRecords();
        const filteredCachedData = isCurrentUserOperator && user?.username
          ? cachedData.filter(d => d.operator_id === user.username)
          : cachedData;
        setProductionRecords(filteredCachedData);
        setMessage('You are offline. Showing cached production data.');
      }
    } catch (error) {
      setMessage(`Error loading data: ${error.message}`);
      setProductionRecords([]);
    } finally {
      setLoading(false);
    }
  }, [canViewThisPage, filters, sortBy, sortOrder, isOffline, user?.username, isCurrentUserOperator]);

  useEffect(() => {
    fetchProductionRecords();
  }, [fetchProductionRecords]);

  // Handlers for filters
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    if (isOffline) {
      setMessage('Filtering disabled while offline, showing cached data.');
      return;
    }
    fetchProductionRecords();
  };

  const handleClearFilters = () => {
    setFilters({
      product_name: '',
      machine_id: '',
      quality_status: '',
    });
    setSortBy('start_time');
    setSortOrder('desc');
    fetchProductionRecords();
  };

  // Sorting handler
  const handleSort = (field) => {
    if (isOffline) {
      setMessage('Sorting disabled while offline.');
      return;
    }
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field) => {
    if (field === sortBy) {
      return sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />;
    }
    return null;
  };

  // Open form for add new record
  const handleAddRecordClick = () => {
    setEditingRecord(null);
    setShowForm(true);
  };

  // Save handler with offline logic added
  const handleSave = async (recordData) => {
    setMessage('');

    // When offline, save new record locally and show immediately
    if (isOffline) {
      let operatorId = recordData.operator_id;
      if (!operatorId && isCurrentUserOperator && user?.username) {
        operatorId = user.username;
      }

      const offlineRecord = {
        ...recordData,
        operator_id: operatorId,
        id: 'offline_' + Date.now(),
        localId: Date.now(),
      };

      try {
        await putOfflineAddition(offlineRecord);
        setMessage('Record saved locally; it will sync when online.');
        setShowForm(false);
        setEditingRecord(null);
        setProductionRecords(prev => [...prev, offlineRecord]);
      } catch (error) {
        setMessage('Failed to save record offline.');
      }
      return;
    }

    // Online behavior is preserved — don't change UI or logic otherwise
    try {
      const token = localStorage.getItem('access_token');
      const tokenType = localStorage.getItem('token_type');

      if (!recordData.id && isCurrentUserOperator && user?.username) {
        recordData.operator_id = user.username;
      }

      let response;

      if (recordData.id) {
        if (!canEditAny) {
          setMessage('Insufficient permissions to update records.');
          return;
        }
        response = await fetch(`http://localhost:8000/production-data/${recordData.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `${tokenType} ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recordData),
        });
      } else {
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
        setMessage(`Record ${recordData.id ? 'updated' : 'added'} successfully.`);
        setShowForm(false);
        fetchProductionRecords();
      } else {
        const errData = await response.json();
        setMessage(`Operation failed: ${errData.detail || response.statusText || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(`Network error: ${error.message}`);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingRecord(null);
  };

  // Edit record handler
  const handleEditRecordClick = (record) => {
    if (isOffline) {
      setMessage('Editing records is not allowed while offline.');
      return;
    }
    if (!canEditAny) {
      setMessage('You do not have permission to edit records.');
      return;
    }
    setEditingRecord(record);
    setShowForm(true);
  };

  // Delete handlers
  const handleDeleteClick = (recordId) => {
    if (isOffline) {
      setMessage('Deleting records is not allowed while offline.');
      return;
    }
    if (!canDeleteAny) {
      setMessage('You do not have permission to delete records.');
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

      if (!canDeleteAny) {
        setMessage('You do not have permission to delete records.');
        return;
      }

      const response = await fetch(`http://localhost:8000/production-data/${recordToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `${tokenType} ${token}`,
        },
      });

      if (response.ok) {
        setMessage('Record deleted successfully.');
        fetchProductionRecords();
      } else {
        const errData = await response.json();
        setMessage(`Failed to delete record: ${errData.detail || response.statusText || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(`Network error during deletion: ${error.message}`);
    } finally {
      setRecordToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
    setRecordToDelete(null);
  };

  if (!canViewThisPage) {
    return (
      <Box p={2}>
        <Alert severity="error">You do not have sufficient privileges to view this page.</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 1200,
        margin: '20px auto',
        padding: 3,
        bgcolor: 'background.paper',
        boxShadow: 3,
        borderRadius: 2,
        minHeight: '80vh',
      }}
    >
      {/* Header */}
      <Box display="flex" alignItems="center" mb={2}>
        <BusinessIcon fontSize="large" color="primary" sx={{ mr: 1 }} />
        <Typography variant="h5">Production Data</Typography>
      </Box>

      {/* Messages */}
      {message && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      {isOffline && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You are offline. Displaying cached data. New records will save locally until online.
        </Alert>
      )}

      {/* Filter Inputs */}
      <Box mb={2} display="flex" flexWrap="wrap" gap={2} alignItems="center">
        <TextField
          label="Product"
          name="product_name"
          value={filters.product_name}
          onChange={handleFilterChange}
          size="small"
          sx={{ minWidth: 150, flexGrow: 1 }}
        />
        <TextField
          label="Machine"
          name="machine_id"
          value={filters.machine_id}
          onChange={handleFilterChange}
          size="small"
          sx={{ minWidth: 150, flexGrow: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 160, flexGrow: 1 }}>
          <InputLabel>Quality Status</InputLabel>
          <Select
            name="quality_status"
            value={filters.quality_status}
            onChange={handleFilterChange}
            label="Quality Status"
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="Passed">Passed</MenuItem>
            <MenuItem value="Failed">Failed</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" onClick={handleApplyFilters} size="medium">
          Search
        </Button>
        <Button
          variant="outlined"
          onClick={handleClearFilters}
          size="medium"
          sx={{ borderWidth: 1.5, whiteSpace: 'nowrap' }}
        >
          Clear Filters
        </Button>
      </Box>

      {/* Add New Record Button */}
      {canAddRecord && (
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleAddRecordClick}
          sx={{ mb: 2, minWidth: 220 }}
        >
          Add New Production Record
        </Button>
      )}

      {/* Production Records Table */}
      <TableContainer component={Paper}>
        <Table size="medium" stickyHeader>
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
                  onClick={() => handleSort(headCell.id)}
                  sx={{
                    fontWeight: 'bold',
                    cursor: isOffline ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      backgroundColor: isOffline ? 'inherit' : 'action.hover',
                    },
                    userSelect: 'none',
                  }}
                >
                  {headCell.label}
                  {renderSortIndicator(headCell.id)}
                </TableCell>
              ))}
              {(canEditAny || canDeleteAny) && <TableCell>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : productionRecords.length > 0 ? (
              productionRecords.map((record) => (
                <TableRow key={record.id || record.localId}>
                  <TableCell>{record.id}</TableCell>
                  <TableCell>{record.product_name}</TableCell>
                  <TableCell>{record.machine_id}</TableCell>
                  <TableCell>{record.operator_id}</TableCell>
                  <TableCell>{record.quantity_produced}</TableCell>
                  <TableCell>{record.start_time ? new Date(record.start_time).toLocaleString() : '-'}</TableCell>
                  <TableCell>{record.end_time ? new Date(record.end_time).toLocaleString() : '-'}</TableCell>
                  <TableCell>{record.quality_status}</TableCell>
                  <TableCell>{record.notes || '-'}</TableCell>
                  {(canEditAny || canDeleteAny) && (
                    <TableCell>
                      {canEditAny && (
                        <IconButton onClick={() => handleEditRecordClick(record)} aria-label="edit" disabled={isOffline}>
                          <EditIcon />
                        </IconButton>
                      )}
                      {canDeleteAny && (
                        <IconButton onClick={() => handleDeleteClick(record.id)} aria-label="delete" disabled={isOffline}>
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  No production data found. {canAddRecord && "Click 'Add New Production Record' to start."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Production Form */}
      {showForm && (
        <ProductionForm record={editingRecord} onSave={handleSave} onCancel={handleCancelForm} />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>Are you sure you want to delete this record? This action cannot be undone.</DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button color="error" onClick={handleConfirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProductionDataPage;
