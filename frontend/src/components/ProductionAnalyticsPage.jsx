// frontend/src/components/ProductionAnalyticsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// --- MUI Imports ---
import {
  Box,
  Typography,
  Paper,
  Alert,
  Grid,
  CircularProgress,
  Button,
} from '@mui/material';
import { styled, keyframes, useTheme } from '@mui/system';

// Icons
import AnalyticsIcon from '@mui/icons-material/Analytics';
import InsightsIcon from '@mui/icons-material/Insights';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';

// Recharts Imports
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// --- Reusing Keyframes from Dashboard.jsx for consistency ---
const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const cardHover = keyframes`
  from { transform: translateY(0); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
  to { transform: translateY(-5px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }
`;

const sectionFadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Styled Paper component for dashboard cards/sections
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: theme.shadows[4],
  transition: 'all 0.3s ease-in-out, border-color 0.3s ease-in-out',
  background: theme.palette.background.paper,
  border: '1px solid transparent',
  height: '100%', // Ensure cards in a grid have equal height
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between', // Push footer to bottom

  '&:hover': {
    animation: `${cardHover} 0.3s forwards`,
    borderColor: theme.palette.primary.main,
    background: theme.palette.action.hover,
  },
  '&:not(:hover)': {
    animation: `${cardHover} 0.3s reverse forwards`,
  },
}));

// Styled Box for the main page container with animated background
const AnalyticsContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.secondary.light} 50%, ${theme.palette.primary.light} 100%)`,
  backgroundSize: '200% 200%',
  animation: `${gradientShift} 15s ease infinite alternate`,
  color: theme.palette.text.primary,
}));


function ProductionAnalyticsPage() {
  const { isAuthenticated, hasRole } = useAuth();
  const theme = useTheme();

  // State for fetched data
  const [overviewData, setOverviewData] = useState(null);
  const [productSummaryData, setProductSummaryData] = useState([]);
  const [operatorSummaryData, setOperatorSummaryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const chartColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.error.main,
    '#FFBB28', '#FF8042', '#00C49F', '#8884d8'
  ];

  const fetchAnalyticsData = useCallback(async () => {
    if (!isAuthenticated() || !hasRole(['admin', 'supervisor', 'viewer'])) { // Define roles that can view this page
      setError('You do not have sufficient privileges to view this page.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const token = localStorage.getItem('access_token');
    const tokenType = localStorage.getItem('token_type');

    const headers = {
      'Authorization': `${tokenType} ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const [overviewRes, productRes, operatorRes] = await Promise.all([
        fetch('http://localhost:8000/production-data/dashboard/overview', { headers }),
        fetch('http://localhost:8000/production-data/dashboard/product_summary', { headers }),
        fetch('http://localhost:8000/production-data/dashboard/operator_summary', { headers }),
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setOverviewData(data);
      } else {
        const errorData = await overviewRes.json();
        setError(prev => prev ? `${prev}; Failed to fetch overview: ${errorData.detail || 'Unknown error'}` : `Failed to fetch overview: ${errorData.detail || 'Unknown error'}`);
      }

      if (productRes.ok) {
        const data = await productRes.json();
        setProductSummaryData(data);
      } else {
        const errorData = await productRes.json();
        setError(prev => prev ? `${prev}; Failed to fetch product summary: ${errorData.detail || 'Unknown error'}` : `Failed to fetch product summary: ${errorData.detail || 'Unknown error'}`);
      }

      if (operatorRes.ok) {
        const data = await operatorRes.json();
        setOperatorSummaryData(data);
      } else {
        const errorData = await operatorRes.json();
        setError(prev => prev ? `${prev}; Failed to fetch operator summary: ${errorData.detail || 'Unknown error'}` : `Failed to fetch operator summary: ${errorData.detail || 'Unknown error'}`);
      }

    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, hasRole]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  if (!isAuthenticated()) {
    return (
      <AnalyticsContainer>
        <Alert severity="info" sx={{ width: '100%', maxWidth: '800px', mt: 3 }}>
          Please log in to view the Production Analytics.
        </Alert>
      </AnalyticsContainer>
    );
  }

  if (loading) {
    return (
      <AnalyticsContainer>
        <CircularProgress sx={{ color: 'primary.main' }} />
        <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>Loading Production Analytics...</Typography>
      </AnalyticsContainer>
    );
  }

  if (error) {
    return (
      <AnalyticsContainer>
        <Alert severity="error" sx={{ width: '100%', maxWidth: '800px', mt: 3 }}>
          {error}
        </Alert>
      </AnalyticsContainer>
    );
  }

  return (
    <AnalyticsContainer>
      <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 4, fontWeight: 'bold', color: 'primary.dark', animation: `${sectionFadeIn} 0.8s ease-out forwards` }}>
        <AnalyticsIcon sx={{ mr: 2, fontSize: 'inherit', verticalAlign: 'middle' }} />
        Production Analytics
      </Typography>

      <Grid container spacing={4} sx={{ maxWidth: '1400px', width: '100%' }}>
        {/* Overall Production Overview Card */}
        {overviewData && (
          <Grid item xs={12} md={6} lg={4} sx={{ animation: `${sectionFadeIn} 0.8s ease-out forwards 0.2s` }}>
            <StyledPaper elevation={8}>
              <Box>
                <Typography variant="h5" gutterBottom sx={{ color: 'secondary.main', mb: 2 }}>
                  <InsightsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Overall Production Overview
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Total Quantity Produced:</strong> {overviewData.total_quantity_produced || 0} units
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Total Records:</strong> {overviewData.total_records || 0}
                </Typography>
                <Typography variant="body1">
                  <strong>Avg. Quality Pass Rate:</strong> {overviewData.average_quality_pass_rate !== undefined ? `${overviewData.average_quality_pass_rate.toFixed(2)}%` : 'N/A'}
                </Typography>
              </Box>
            </StyledPaper>
          </Grid>
        )}

        {/* Product Production Summary (Bar Chart) */}
        {productSummaryData.length > 0 && (
          <Grid item xs={12} md={6} lg={8} sx={{ animation: `${sectionFadeIn} 0.8s ease-out forwards 0.4s` }}>
            <StyledPaper elevation={8}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" gutterBottom sx={{ color: 'secondary.main', mb: 2 }}>
                  <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Product Production Summary
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={productSummaryData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="product_name" stroke={theme.palette.text.secondary} />
                    <YAxis stroke={theme.palette.text.secondary} />
                    <Tooltip
                      contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: '8px' }}
                      labelStyle={{ color: theme.palette.text.primary }}
                      itemStyle={{ color: theme.palette.text.secondary }}
                    />
                    <Legend />
                    <Bar dataKey="total_quantity_produced" name="Total Quantity" fill={chartColors[0]} />
                    <Bar dataKey="num_records" name="Number of Records" fill={chartColors[1]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </StyledPaper>
          </Grid>
        )}

        {/* Operator Performance Summary (Bar and Pie Charts) */}
        {operatorSummaryData.length > 0 && (
          <Grid item xs={12} sx={{ animation: `${sectionFadeIn} 0.8s ease-out forwards 0.6s` }}>
            <StyledPaper elevation={8}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" gutterBottom sx={{ color: 'secondary.main', mb: 2 }}>
                  <PeopleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Operator Performance Summary
                </Typography>
                <Grid container spacing={4}> {/* Increased spacing for better separation */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" align="center" sx={{ mb: 1, color: 'text.primary' }}>Quantity by Operator</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={operatorSummaryData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                        <XAxis dataKey="operator_id" stroke={theme.palette.text.secondary} />
                        <YAxis stroke={theme.palette.text.secondary} />
                        <Tooltip
                          contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: '8px' }}
                          labelStyle={{ color: theme.palette.text.primary }}
                          itemStyle={{ color: theme.palette.text.secondary }}
                        />
                        <Legend />
                        <Bar dataKey="total_quantity_produced" name="Total Quantity" fill={chartColors[2]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" align="center" sx={{ mb: 1, color: 'text.primary' }}>Quality Pass Rate by Operator</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={operatorSummaryData.map(op => ({ name: op.operator_id, value: op.quality_pass_rate }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {
                            operatorSummaryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                            ))
                          }
                        </Pie>
                        <Tooltip
                          formatter={(value) => `${value.toFixed(2)}%`}
                          contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: '8px' }}
                          labelStyle={{ color: theme.palette.text.primary }}
                          itemStyle={{ color: theme.palette.text.secondary }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Grid>
                </Grid>
              </Box>
            </StyledPaper>
          </Grid>
        )}

        {/* Message if no data is available after loading */}
        {!overviewData && productSummaryData.length === 0 && operatorSummaryData.length === 0 && (
          <Grid item xs={12} sx={{ textAlign: 'center', mt: 4 }}>
            <Alert severity="info" sx={{ width: '100%', maxWidth: '600px', mx: 'auto' }}>
              No production analytics data available.
            </Alert>
          </Grid>
        )}

      </Grid>
    </AnalyticsContainer>
  );
}

export default ProductionAnalyticsPage;
