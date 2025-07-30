import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Fade,
  Zoom,
  IconButton,
  Collapse,
} from "@mui/material";
import { ExpandMore, ExpandLess, CheckCircle, Cancel } from "@mui/icons-material";

// Background style and transition
const approvalPageBg = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #2361ad 0%, #19a2ae 70%, #dee7ec 100%)",
  padding: "40px 0",
  transition: "background 0.8s cubic-bezier(.47,1.64,.41,.8)",
};

const recordDetailStyle = {
  background: "rgba(255,255,255,0.95)",
  borderRadius: "16px",
  marginBottom: 16,
  boxShadow: "0 6px 28px 0px #0b336733",
  transition: "box-shadow .25s",
};

const actionBtnStyle = {
  minWidth: 80,
  fontWeight: "bold",
  letterSpacing: 1,
  margin: "4px 8px 4px 0",
};

function SupervisorApprovalPage() {
  const { isAuthenticated, hasRole } = useAuth();
  const [pendingRecords, setPendingRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [expanded, setExpanded] = useState({});
  const [processingId, setProcessingId] = useState(null);

  const API_BASE_URL = "http://localhost:8000"; // Adjust if your backend URL or prefix differs

  // Early return if not authenticated or not supervisor
  if (!isAuthenticated() || !hasRole(["supervisor"])) {
    return (
      <Box sx={{ ...approvalPageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Fade in>
          <Alert severity="error" sx={{ fontSize: 18, px: 4, py: 2 }}>
            You do not have permission to access this page.
          </Alert>
        </Fade>
      </Box>
    );
  }

  // Fetch pending records from backend
  const fetchPendingRecords = async () => {
    setLoading(true);
    setError(null);
    setActionMessage("");
    try {
      const token = localStorage.getItem("access_token");
      const tokenType = localStorage.getItem("token_type") || "Bearer";
      const response = await fetch(`${API_BASE_URL}/production-data?status=pending`, {
        method: "GET",
        headers: {
          Authorization: `${tokenType} ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch pending production data.");
      const data = await response.json();
      // Defensive: filter in frontend in case backend doesn't filter status param
      setPendingRecords(data.filter((rec) => rec.status === "pending"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run fetch once on mount
  useEffect(() => {
    fetchPendingRecords();
    // eslint-disable-next-line
  }, []);

  // Expand/collapse toggle for record details
  const handleExpandClick = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Approve action
  const handleApprove = async (id) => {
    if (!window.confirm("Approve this production record?")) return;
    setProcessingId(id);
    setActionMessage("");
    try {
      const token = localStorage.getItem("access_token");
      const tokenType = localStorage.getItem("token_type") || "Bearer";
      const response = await fetch(`${API_BASE_URL}/production-data/${id}/approve`, {
        method: "POST",
        headers: {
          Authorization: `${tokenType} ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Approval failed");
      }
      setActionMessage("✅ Record approved successfully.");
      fetchPendingRecords();
    } catch (err) {
      setActionMessage(`❌ Error: ${err.message}`);
    }
    setProcessingId(null);
  };

  // Reject action
  const handleReject = async (id) => {
    if (!window.confirm("Reject this production record?")) return;
    setProcessingId(id);
    setActionMessage("");
    try {
      const token = localStorage.getItem("access_token");
      const tokenType = localStorage.getItem("token_type") || "Bearer";
      const response = await fetch(`${API_BASE_URL}/production-data/${id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `${tokenType} ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Rejection failed");
      }
      setActionMessage("Record rejected successfully.");
      fetchPendingRecords();
    } catch (err) {
      setActionMessage(`❌ Error: ${err.message}`);
    }
    setProcessingId(null);
  };

  return (
    <Box sx={approvalPageBg}>
      <Fade in timeout={1000}>
        <Box
          sx={{
            maxWidth: 1150,
            mx: "auto",
            boxShadow: "0 12px 40px 0 #405b7e52",
            borderRadius: 4,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: { xs: 2, sm: 4 },
              background: "rgba(255,255,255,0.85)",
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              mb: 2,
              boxShadow: "0 2px 12px 0 #bfeeff33",
            }}
          >
            <Typography variant="h4" fontWeight={700} letterSpacing={1} color="#1a426a">
              Pending Production Data Approvals
            </Typography>
            <Zoom in={Boolean(processingId)}>
              <CircularProgress color="success" size={40} />
            </Zoom>
          </Box>

          <Box sx={{ px: { xs: 0, sm: 2 }, pb: 4 }}>
            {actionMessage && (
              <Fade in>
                <Alert
                  severity={actionMessage.startsWith("❌") ? "error" : "success"}
                  sx={{ mb: 2, fontSize: 18, alignItems: "center", boxShadow: "0 8px 20px -8px #53a8ed44" }}
                >
                  {actionMessage}
                </Alert>
              </Fade>
            )}
            {error && (
              <Fade in>
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              </Fade>
            )}
            {loading ? (
              <Box sx={{ minHeight: 120, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <CircularProgress size={48} thickness={3} />
              </Box>
            ) : pendingRecords.length === 0 ? (
              <Fade in>
                <Typography
                  fontSize={22}
                  fontWeight={500}
                  color="#38496a"
                  sx={{
                    background: "#fff !important",
                    borderRadius: 3,
                    px: 3,
                    py: 2,
                    boxShadow: "0 0 24px 0 #aac9e633",
                  }}
                >
                  No pending production data requests to approve.
                </Typography>
              </Fade>
            ) : (
              <TableContainer
                component={Paper}
                sx={{
                  borderRadius: 6,
                  overflow: "hidden",
                  background: "rgba(247, 250, 255, 0.97)",
                  boxShadow: "0 0 32px -10px #6e93c066",
                  transition: "background 0.8s cubic-bezier(.77,.2,.17,.97)",
                }}
              >
                <Table aria-label="Pending approvals">
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      <TableCell sx={{ fontWeight: 700, letterSpacing: 1, fontSize: 16 }}>Product</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 16 }}>Machine</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 16 }}>Operator</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 16 }}>Qty</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 16 }}>Production Date</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 16 }}>Shift</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 16 }}>Comments</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 16 }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingRecords.map((rec, idx) => {
                      const key = rec._id || rec.id;
                      return (
                        <React.Fragment key={key}>
                          <TableRow
                            hover
                            sx={{
                              "&:hover": { background: "#eaf8fd !important" },
                              background: idx % 2 === 0 ? "#f7fdff" : "#e5f6fe",
                              borderLeft: "6px solid #26c6da",
                            }}
                          >
                            <TableCell>
                              <IconButton aria-label="expand row" size="small" onClick={() => handleExpandClick(key)}>
                                {expanded[key] ? <ExpandLess /> : <ExpandMore />}
                              </IconButton>
                            </TableCell>
                            <TableCell>{rec.productName}</TableCell>
                            <TableCell>{rec.machineId}</TableCell>
                            <TableCell>{rec.operatorId}</TableCell>
                            <TableCell>{rec.quantityProduced}</TableCell>
                            <TableCell>{rec.production_date ? new Date(rec.production_date).toLocaleString() : "-"}</TableCell>
                            <TableCell>{rec.shift || "-"}</TableCell>
                            <TableCell>{rec.comments || "-"}</TableCell>
                            <TableCell align="center">
                              <Button
                                variant="contained"
                                color="success"
                                disabled={processingId === key}
                                sx={actionBtnStyle}
                                startIcon={<CheckCircle />}
                                onClick={() => handleApprove(key)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outlined"
                                color="error"
                                disabled={processingId === key}
                                sx={actionBtnStyle}
                                startIcon={<Cancel />}
                                onClick={() => handleReject(key)}
                              >
                                Reject
                              </Button>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
                              <Collapse in={expanded[key]} timeout="auto" unmountOnExit>
                                <Box sx={{ ...recordDetailStyle, mx: 1, my: 2, px: 3, py: 2 }}>
                                  <Typography fontWeight={600} fontSize={19} color="#206192" mb={1}>
                                    Production Record Details
                                  </Typography>
                                  <dl
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "140px 1fr",
                                      rowGap: 10,
                                      columnGap: 20,
                                      margin: 0,
                                    }}
                                  >
                                    <dt style={{ fontWeight: 500, color: "#566" }}>Time Taken (minutes):</dt>
                                    <dd style={{ margin: 0 }}>{rec.timeTakenMinutes ?? "-"}</dd>
                                    <dt style={{ fontWeight: 500, color: "#566" }}>Record ID:</dt>
                                    <dd style={{ margin: 0 }}>{key}</dd>
                                  </dl>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      </Fade>
    </Box>
  );
}

export default SupervisorApprovalPage;
