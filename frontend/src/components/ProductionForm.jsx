// frontend/src/components/ProductionForm.jsx
import React, { useState, useEffect } from 'react';
import { parseISO, format } from 'date-fns'; // For consistent date handling

// --- NEW MUI IMPORTS ---
import {
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Dialog, // Use Dialog for the modal functionality
  DialogTitle,
  DialogContent,
  DialogActions,
  Slide, // For transition effect
} from '@mui/material';
import { styled, keyframes } from '@mui/system'; // For custom animations and styled components

// Transition component for the Dialog
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Define a subtle glow animation for elements
const glow = keyframes`
  0% { box-shadow: 0 0 3px rgba(0, 123, 255, 0.2), 0 0 6px rgba(0, 123, 255, 0.1); }
  50% { box-shadow: 0 0 10px rgba(0, 123, 255, 0.4), 0 0 20px rgba(0, 123, 255, 0.3); }
  100% { box-shadow: 0 0 3px rgba(0, 123, 255, 0.2), 0 0 6px rgba(0, 123, 255, 0.1); }
`;

// Define a more vibrant glow for primary elements (adjusted for lighter effect)
const vibrantGlow = keyframes`
  0% { box-shadow: 0 0 5px rgba(0, 123, 255, 0.4), 0 0 10px rgba(0, 123, 255, 0.3); }
  50% { box-shadow: 0 0 15px rgba(0, 123, 255, 0.6), 0 0 30px rgba(0, 123, 255, 0.5); }
  100% { box-shadow: 0 0 5px rgba(0, 123, 255, 0.4), 0 0 10px rgba(0, 123, 255, 0.3); }
`;

// Styled Button with glowing effect on hover
const GlowButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.2, 2.5),
  fontSize: '1rem',
  fontWeight: 600,
  borderRadius: theme.shape.borderRadius * 1.5,
  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.light} 90%)`,
  boxShadow: `0 1px 2px 0px rgba(25, 118, 210, .1)`,
  transition: 'all 0.3s ease-in-out',

  '&:hover': {
    background: `linear-gradient(45deg, ${theme.palette.primary.dark} 30%, ${theme.palette.primary.main} 90%)`,
    boxShadow: `0 1px 3px 0px rgba(25, 118, 210, .2)`,
    transform: 'translateY(-2px)',
    animation: `${vibrantGlow} 1.5s infinite alternate`,
  },
  '&:active': {
    transform: 'translateY(0)',
    boxShadow: `0 0px 1px 0px rgba(25, 118, 210, .05)`,
  },
}));


function ProductionForm({ initialData = null, onSave, onCancel }) {
  // Initialize form state with initialData if provided, otherwise empty
  const [productName, setProductName] = useState(initialData?.product_name || '');
  const [machineId, setMachineId] = useState(initialData?.machine_id || '');
  const [operatorId, setOperatorId] = useState(initialData?.operator_id || '');
  const [quantityProduced, setQuantityProduced] = useState(initialData?.quantity_produced || '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [qualityStatus, setQualityStatus] = useState(initialData?.quality_status || 'Passed'); // Default to Passed
  const [notes, setNotes] = useState(initialData?.notes || '');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Utility to format date for datetime-local input
  const formatDateTimeLocal = (isoString) => {
    if (!isoString) return '';
    try {
      const date = parseISO(isoString); // Use date-fns parseISO
      if (isNaN(date.getTime())) return ''; // Check if date is valid
      return format(date, "yyyy-MM-dd'T'HH:mm"); // Format for datetime-local input
    } catch (e) {
      console.error("Error parsing date for datetime-local:", e);
      return '';
    }
  };

  // Effect to update form if initialData changes (e.g., when editing a different record)
  useEffect(() => {
    if (initialData) {
      setProductName(initialData.product_name || '');
      setMachineId(initialData.machine_id || '');
      setOperatorId(initialData.operator_id || '');
      setQuantityProduced(initialData.quantity_produced || '');
      setStartTime(formatDateTimeLocal(initialData.start_time));
      setEndTime(formatDateTimeLocal(initialData.end_time));
      setQualityStatus(initialData.quality_status || 'Passed');
      setNotes(initialData.notes || '');
    } else {
      // Reset form for new record if initialData is null
      setProductName('');
      setMachineId('');
      setOperatorId('');
      setQuantityProduced('');
      setStartTime(''); // Clear for new record
      setEndTime('');   // Clear for new record
      setQualityStatus('Passed');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Basic validation
    if (!productName || !machineId || !operatorId || !quantityProduced || !startTime || !endTime || !qualityStatus) {
      setError('Please fill in all required fields.');
      setIsLoading(false);
      return;
    }
    if (isNaN(quantityProduced) || parseInt(quantityProduced) <= 0) {
        setError('Quantity Produced must be a positive number.');
        setIsLoading(false);
        return;
    }
    if (parseISO(startTime) >= parseISO(endTime)) { // Use parseISO for comparison
        setError('End Time must be after Start Time.');
        setIsLoading(false);
        return;
    }


    const recordData = {
      id: initialData?.id, // Include ID if it's an update
      product_name: productName,
      machine_id: machineId,
      operator_id: operatorId,
      quantity_produced: parseInt(quantityProduced),
      start_time: parseISO(startTime).toISOString(), // Convert to ISO string for backend
      end_time: parseISO(endTime).toISOString(),     // Convert to ISO string for backend
      quality_status: qualityStatus,
      notes: notes || null, // Send null if notes are empty
    };

    try {
      await onSave(recordData); // Call the onSave prop from parent
      // No need to set isLoading(false) here, as onSave typically handles it or parent closes form
    } catch (err) {
      setError(`Error saving record: ${err.message}`);
    } finally {
      setIsLoading(false); // Ensure loading is turned off even if onSave doesn't
    }
  };

  // Dialog open state is managed by the parent (ProductionDataPage)
  // This component is rendered only when showForm is true in parent.
  // The onClose prop of Dialog will call onCancel from parent.
  return (
    <Dialog
      open={true} // Always open when this component is mounted
      onClose={onCancel} // Close handler from parent
      TransitionComponent={Transition}
      fullWidth
      maxWidth="md" // Adjust max width as needed, 'md' or 'lg' for more space
      PaperProps={{
        sx: {
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          background: 'linear-gradient(145deg, #ffffff, #f0f0f0)', // Subtle gradient background
          overflow: 'hidden', // Ensure content stays within rounded corners
        }
      }}
    >
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', py: 2, px: 3, mb: 2 }}>
        <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
          {initialData ? 'Edit Production Record' : 'Add New Production Record'}
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}> {/* Added padding and dividers */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField
            label="Product Name"
            variant="outlined"
            fullWidth
            id="productName"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 6px rgba(0, 123, 255, 0.4)`,
                },
              },
            }}
          />
          <TextField
            label="Machine ID"
            variant="outlined"
            fullWidth
            id="machineId"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            required
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 6px rgba(0, 123, 255, 0.4)`,
                },
              },
            }}
          />
          <TextField
            label="Operator ID"
            variant="outlined"
            fullWidth
            id="operatorId"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            required
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 6px rgba(0, 123, 255, 0.4)`,
                },
              },
            }}
          />
          <TextField
            label="Quantity Produced"
            variant="outlined"
            fullWidth
            type="number"
            id="quantityProduced"
            value={quantityProduced}
            onChange={(e) => setQuantityProduced(e.target.value)}
            required
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 6px rgba(0, 123, 255, 0.4)`,
                },
              },
            }}
          />
          <TextField
            label="Start Time"
            variant="outlined"
            fullWidth
            type="datetime-local"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            disabled={isLoading}
            InputLabelProps={{
              shrink: true, // Always shrink label for datetime-local
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 6px rgba(0, 123, 255, 0.4)`,
                },
              },
            }}
          />
          <TextField
            label="End Time"
            variant="outlined"
            fullWidth
            type="datetime-local"
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            disabled={isLoading}
            InputLabelProps={{
              shrink: true, // Always shrink label for datetime-local
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 6px rgba(0, 123, 255, 0.4)`,
                },
              },
            }}
          />
          <FormControl fullWidth variant="outlined" required disabled={isLoading} sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 6px rgba(0, 123, 255, 0.4)`,
                },
              },
            }}>
            <InputLabel id="qualityStatus-label">Quality Status</InputLabel>
            <Select
              labelId="qualityStatus-label"
              id="qualityStatus"
              value={qualityStatus}
              onChange={(e) => setQualityStatus(e.target.value)}
              label="Quality Status"
            >
              <MenuItem value="Passed">Passed</MenuItem>
              <MenuItem value="Failed">Failed</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Notes (Optional)"
            variant="outlined"
            fullWidth
            multiline
            rows={3} // Adjust height for textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isLoading}
            sx={{ gridColumn: '1 / -1', // Span across all columns
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(0, 123, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'primary.main' },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.dark',
                  boxShadow: `0 0 6px rgba(0, 123, 255, 0.4)`,
                },
              },
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onCancel} color="secondary" variant="outlined" disabled={isLoading}>
          Cancel
        </Button>
        <GlowButton type="submit" variant="contained" disabled={isLoading} onClick={handleSubmit}>
          {isLoading ? <CircularProgress size={24} color="inherit" /> : (initialData ? 'Update Record' : 'Add Record')}
        </GlowButton>
      </DialogActions>
    </Dialog>
  );
}

export default ProductionForm;
