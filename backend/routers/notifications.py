from fastapi import APIRouter, HTTPException, status, Query, Depends # ADDED Depends here
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime
import uuid # For generating unique IDs

# Add these imports for authentication and roles
from ..dependencies import get_current_user, role_required
from ..schemas import UserResponse # ADDED this line

router = APIRouter(
    prefix="/notifications", # This router's base path
    tags=["Notifications"],
)

# --- Pydantic Models for Notifications ---

class NotificationBase(BaseModel):
    """Base model for notification data."""
    recipient_id: str = Field(..., example="user_123", description="ID of the user or entity receiving the notification")
    message: str = Field(..., example="Your daily report is ready.", description="The content of the notification")
    type: str = Field(..., example="system_alert", description="Type of notification (e.g., 'system_alert', 'report_ready', 'machine_fault')")

class NotificationCreate(NotificationBase):
    """Model for creating a new notification."""
    pass

class NotificationUpdate(BaseModel):
    """Model for updating an existing notification."""
    is_read: Optional[bool] = Field(None, description="Set to true to mark as read, false to mark as unread")

class Notification(NotificationBase):
    """Full notification model, including generated fields."""
    id: str = Field(..., example="notif_abc123", description="Unique ID of the notification")
    timestamp: datetime = Field(default_factory=datetime.now, description="Timestamp when the notification was created")
    is_read: bool = Field(default=False, description="Whether the notification has been read by the recipient")

# --- In-memory "Database" for Notifications ---
mock_notifications_db: Dict[str, Notification] = {
    "notif_001": Notification(
        id="notif_001",
        recipient_id="user_123",
        message="New machine maintenance scheduled for Machine-005.",
        type="maintenance_alert",
        timestamp=datetime.now()
    ),
    "notif_002": Notification(
        id="notif_002",
        recipient_id="user_456",
        message="Production run 'batch_X' completed successfully.",
        type="production_update",
        timestamp=datetime.now(),
        is_read=True
    ),
    "notif_003": Notification(
        id="notif_123",
        recipient_id="user_123",
        message="Critical error detected on sensor_A in Zone 3.",
        type="critical_error",
        timestamp=datetime.now()
    )
}

# --- API Endpoints for Notifications ---

@router.post(
    "/",
    response_model=Notification,
    status_code=status.HTTP_201_CREATED,
    summary="Create and Send a Notification"
)
async def create_notification(
    notification: NotificationCreate,
    current_user: UserResponse = Depends(role_required(["admin"])) # ADMIN ONLY
):
    """
    Creates and sends a new notification.
    Requires 'admin' role.

    - **recipient_id**: The ID of the user or system component to notify.
    - **message**: The content of the notification.
    - **type**: The category or type of the notification (e.g., 'alert', 'info', 'warning').
    """
    notification_id = str(uuid.uuid4()) # Generate a unique ID
    new_notification = Notification(id=notification_id, **notification.model_dump())
    mock_notifications_db[notification_id] = new_notification
    return new_notification

@router.get(
    "/",
    response_model=List[Notification],
    summary="Get All Notifications"
)
async def get_all_notifications(
    recipient_id: Optional[str] = Query(None, description="Filter notifications by recipient ID"),
    is_read: Optional[bool] = Query(None, description="Filter notifications by read status (true for read, false for unread)"),
    notification_type: Optional[str] = Query(None, alias="type", description="Filter notifications by type (e.g., 'system_alert')"),
    current_user: UserResponse = Depends(role_required(["admin"])) # ADMIN ONLY
):
    """
    Retrieves a list of all notifications, with optional filtering by recipient,
    read status, or type.
    Requires 'admin' role.
    """
    filtered_notifications = list(mock_notifications_db.values())

    if recipient_id:
        filtered_notifications = [n for n in filtered_notifications if n.recipient_id == recipient_id]
    if is_read is not None:
        filtered_notifications = [n for n in filtered_notifications if n.is_read == is_read]
    if notification_type:
        filtered_notifications = [n for n in filtered_notifications if n.type == notification_type]

    # Sort by timestamp, newest first
    return sorted(filtered_notifications, key=lambda n: n.timestamp, reverse=True)

@router.get(
    "/{notification_id}",
    response_model=Notification,
    summary="Get Notification by ID"
)
async def get_notification_by_id(
    notification_id: str,
    current_user: UserResponse = Depends(role_required(["admin"])) # ADMIN ONLY
):
    """
    Retrieves a single notification by its unique ID.
    Requires 'admin' role.
    """
    notification = mock_notifications_db.get(notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification '{notification_id}' not found."
        )
    return notification

@router.put(
    "/{notification_id}",
    response_model=Notification,
    summary="Update Notification Status"
)
async def update_notification(
    notification_id: str,
    notification_update: NotificationUpdate,
    current_user: UserResponse = Depends(role_required(["admin"])) # ADMIN ONLY
):
    """
    Updates the status of an existing notification (e.g., marking it as read).
    Requires 'admin' role.
    """
    notification = mock_notifications_db.get(notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification '{notification_id}' not found."
        )

    update_data = notification_update.model_dump(exclude_unset=True)
    updated_notification = notification.model_copy(update=update_data)
    mock_notifications_db[notification_id] = updated_notification
    return updated_notification

@router.delete(
    "/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Notification"
)
async def delete_notification(
    notification_id: str,
    current_user: UserResponse = Depends(role_required(["admin"])) # ADMIN ONLY
):
    """
    Deletes a notification by its unique ID.
    Requires 'admin' role.
    """
    if notification_id not in mock_notifications_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification '{notification_id}' not found."
        )
    del mock_notifications_db[notification_id]
    return {"message": "Notification deleted successfully"}