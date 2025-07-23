# backend/routers/reports.py

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Dict, Any
from datetime import date

# Import the necessary dependencies and schema
from ..dependencies import get_current_user, role_required
from ..schemas import UserResponse # Assuming UserResponse is defined in schemas.py

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)

# --- Example 1: Get a simple daily summary report ---
@router.get("/daily_summary", summary="Get daily activity summary")
async def get_daily_summary(
    report_date: date = date.today(),
    # ONLY 'admin' role can access this
    current_user: UserResponse = Depends(role_required(["admin"]))
) -> Dict[str, Any]:
    """
    Retrieves a summary of activities for a specific date.
    Requires 'admin' role.

    - **report_date**: The date for which to retrieve the summary (defaults to today).
    """
    # In a real application, you'd fetch data from your database here.
    # For demonstration, we'll return mock data.

    if report_date > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate future reports."
        )

    # Mock data - replace with actual database queries
    daily_data = {
        "date": report_date.isoformat(),
        "total_users_registered": 150 + report_date.day,
        "new_tasks_created": 30 + (report_date.day % 10),
        "tasks_completed": 25 + (report_date.month % 5),
        "revenue_generated": round(1500.50 + (report_date.day * 10.25), 2),
    }

    return daily_data

# --- Example 2: Get a list of recent activities ---
@router.get("/recent_activities", summary="Get a list of recent activities")
async def get_recent_activities(
    limit: int = 10,
    offset: int = 0,
    # ONLY 'admin' role can access this
    current_user: UserResponse = Depends(role_required(["admin"]))
) -> List[Dict[str, Any]]:
    """
    Retrieves a list of the most recent activities.
    Requires 'admin' role.

    - **limit**: Maximum number of activities to return (default: 10).
    - **offset**: Number of activities to skip (default: 0).
    """
    if limit <= 0 or offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be positive and offset non-negative."
        )

    # Mock data - replace with actual database queries
    mock_activities = [
        {"id": 1, "type": "user_registered", "timestamp": "2025-07-09T10:00:00Z", "details": "New user 'Alice' registered"},
        {"id": 2, "type": "task_created", "timestamp": "2025-07-09T10:15:00Z", "details": "Task 'Implement Feature X' created"},
        {"id": 3, "type": "task_completed", "timestamp": "2025-07-09T11:30:00Z", "details": "Task 'Fix Bug Y' completed"},
        {"id": 4, "type": "user_login", "timestamp": "2025-07-09T12:00:00Z", "details": "User 'Bob' logged in"},
        {"id": 5, "type": "payment_received", "timestamp": "2025-07-09T13:45:00Z", "details": "Received $50.00 from 'Charlie'"},
        {"id": 6, "type": "user_registered", "timestamp": "2025-07-08T09:00:00Z", "details": "New user 'David' registered"},
        {"id": 7, "type": "task_created", "timestamp": "2025-07-08T09:30:00Z", "details": "Task 'Prepare Monthly Report' created"},
        {"id": 8, "type": "task_completed", "timestamp": "2025-07-08T10:45:00Z", "details": "Task 'Review Code' completed"},
        {"id": 9, "type": "user_login", "timestamp": "2025-07-08T11:00:00Z", "details": "User 'Eve' logged in"},
        {"id": 10, "type": "payment_received", "timestamp": "2025-07-08T14:00:00Z", "details": "Received $120.00 from 'Frank'"},
    ]
    
    # Apply limit and offset for pagination
    return mock_activities[offset : offset + limit]