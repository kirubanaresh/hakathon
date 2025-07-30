# backend/production_data/router.py

from fastapi import APIRouter, HTTPException, status, Query, Body, Depends # ADDED Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime, date,timezone
import io # NEW: Import io for in-memory file handling
import csv
from ..dependencies import get_current_user, role_required, get_database
# Add these imports for authentication and roles
from ..dependencies import get_current_user, role_required
from ..schemas import UserResponse # Assuming UserResponse is defined
from enum import Enum

router = APIRouter(
    prefix="/production-data", # Corrected prefix from previous code, it should be /production-data
    tags=["Production Data"],
)
def make_datetime_aware(dt: datetime) -> datetime:
    """Converts a datetime object to be timezone-aware (UTC) if it's naive."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

# --- Pydantic Models for Production Data ---

class ProductionStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class ProductionRecord(BaseModel):
    id: str
    product_name: str
    machine_id: str
    operator_id: str
    quantity_produced: int
    start_time: datetime
    end_time: datetime
    quality_status: str
    notes: Optional[str] = None
    status: ProductionStatus = ProductionStatus.pending


class ProductionRecordCreate(BaseModel):
    product_name: str
    machine_id: str
    operator_id: str
    quantity_produced: int
    start_time: datetime
    end_time: datetime
    quality_status: str
    notes: Optional[str] = None


class ProductionRecordUpdate(BaseModel):
    product_name: Optional[str] = None
    machine_id: Optional[str] = None
    operator_id: Optional[str] = None
    quantity_produced: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    quality_status: Optional[str] = None
    notes: Optional[str] = None

# --- In-memory "Database" for demonstration ---
# In a real application, this would interact with a persistent database.
mock_production_db: Dict[str, ProductionRecord] = {
    # Example starting data with 'status'
    "prod_rec_001": ProductionRecord(
        id="prod_rec_001",
        product_name="Widget A",
        machine_id="Machine-001",
        operator_id="Op-005",
        quantity_produced=150,
        start_time=datetime(2025, 7, 9, 8, 0, 0),
        end_time=datetime(2025, 7, 9, 8, 30, 0),
        quality_status="Passed",
        notes="First run of the day.",
        status=ProductionStatus.approved
    ),
    "prod_rec_002": ProductionRecord(
        id="prod_rec_002",
        product_name="Gadget B",
        machine_id="Machine-002",
        operator_id="Op-007",
        quantity_produced=200,
        start_time=datetime(2025, 7, 9, 9, 0, 0),
        end_time=datetime(2025, 7, 9, 9, 45, 0),
        quality_status="Passed",
        notes="High efficiency run.",
        status=ProductionStatus.pending
    ),
    "prod_rec_004": ProductionRecord(
        id="prod_rec_004",
        product_name="Component C",
        machine_id="Machine-003",
        operator_id="Op-001",
        quantity_produced=500,
        start_time=datetime(2025, 6, 25, 14, 0, 0), # Note: This is from June 25th
        end_time=datetime(2025, 6, 25, 14, 50, 0),
        quality_status="Passed",
        notes="Monthly production batch.",
        status=ProductionStatus.approved
    ),
    "prod_rec_003": ProductionRecord(
        id="prod_rec_003",
        product_name="Widget A",
        machine_id="Machine-001",
        operator_id="Op-005",
        quantity_produced=120,
        start_time=datetime(2025, 7, 8, 10, 0, 0), # Note: This is from July 8th
        end_time=datetime(2025, 7, 8, 10, 25, 0),
        quality_status="Failed",
        notes="Material defect detected.",
        status=ProductionStatus.pending
    ),
}

# --- CRUD Endpoints for Production Records ---

@router.post(
    "/",
    response_model=ProductionRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Create Production Record"
)
async def create_production_record(
    record: ProductionRecordCreate,
    current_user: UserResponse = Depends(role_required(["operator", "admin"])),  # Supervisor should not create
):
    """
    Creates a new production record (status=pending regardless of input).
    """
    new_id = f"prod_rec_{len(mock_production_db) + 1:03d}"
    new_record = ProductionRecord(
        id=new_id,
        **record.model_dump(),
        status=ProductionStatus.pending  # force pending status
    )
    mock_production_db[new_id] = new_record
    return new_record


@router.get("/", response_model=List[ProductionRecord], summary="Get All Production Records")
async def get_all_production_records(
    product_name: Optional[str] = Query(None),
    machine_id: Optional[str] = Query(None),
    operator_id: Optional[str] = Query(None),
    quality_status: Optional[str] = Query(None),
    status: Optional[ProductionStatus] = Query(None),
    sort_by: Optional[str] = Query("start_time"),
    sort_order: Optional[str] = Query("desc"),
    current_user: UserResponse = Depends(role_required(["operator", "supervisor", "admin"]))
):
    # Fetch all records
    records = list(mock_production_db.values())

    # Determine user role priority
    if "admin" in current_user.roles:
        role = "admin"
    elif "supervisor" in current_user.roles:
        role = "supervisor"
    else:
        role = "operator"

    filtered = []

    for record in records:
        match = True

        # Role-based access filter
        if role == "admin":
            # Admin sees only approved
            if record.status != ProductionStatus.approved:
                match = False
        elif role == "supervisor":
            # Supervisor sees pending and approved
            if record.status not in (ProductionStatus.pending, ProductionStatus.approved):
                match = False
        else:  # operator
            # Operator sees only own records
            if record.operator_id != current_user.username:
                match = False

        # Apply filters (case-insensitive for strings)
        if product_name and product_name.lower() not in record.product_name.lower():
            match = False
        if machine_id and machine_id.lower() not in record.machine_id.lower():
            match = False
        if operator_id and operator_id.lower() not in record.operator_id.lower():
            match = False
        if quality_status and record.quality_status != quality_status:
            match = False
        # Status filter overrides role-based defaults if provided
        if status and record.status != status:
            match = False
        if record.status != ProductionStatus.approved:
            match = False
        if match:
            filtered.append(record)

    # Normalize datetime fields for safe sorting between naive and aware
    for rec in filtered:
        if rec.start_time and rec.start_time.tzinfo is None:
            rec.start_time = rec.start_time.replace(tzinfo=timezone.utc)
        if rec.end_time and rec.end_time.tzinfo is None:
            rec.end_time = rec.end_time.replace(tzinfo=timezone.utc)

    # Validate sort field
    valid_sort_fields = [
        "product_name", "machine_id", "operator_id",
        "quantity_produced", "start_time", "end_time",
        "quality_status", "notes", "id", "status"
    ]
    if sort_by not in valid_sort_fields:
        sort_by = "start_time"

    reverse_sort = sort_order.lower() == "desc"

    # Sort safely by field type
    if sort_by in ("start_time", "end_time"):
        filtered.sort(key=lambda x: getattr(x, sort_by), reverse=reverse_sort)
    else:
        filtered.sort(
            key=lambda x: (
                (getattr(x, sort_by) or "").lower()
                if isinstance(getattr(x, sort_by), str) else getattr(x, sort_by)
            ),
            reverse=reverse_sort
        )

    return filtered


@router.put("/{record_id}", response_model=ProductionRecord, summary="Update Production Record")
async def update_production_record(
    record_id: str,
    record_update: ProductionRecordUpdate,
    current_user: UserResponse = Depends(role_required(["admin"])),
):
    record = mock_production_db.get(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Production record '{record_id}' not found.")
    if record.status != ProductionStatus.approved:
        raise HTTPException(status_code=400, detail="Only approved records can be edited by admin.")
    update_data = record_update.model_dump(exclude_unset=True)
    if "start_time" in update_data:
        update_data["start_time"] = make_datetime_aware(update_data["start_time"])
    if "end_time" in update_data:
        update_data["end_time"] = make_datetime_aware(update_data["end_time"])
    updated_record = record.model_copy(update=update_data)
    mock_production_db[record_id] = updated_record
    return updated_record

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Production Record")
async def delete_production_record(
    record_id: str,
    current_user: UserResponse = Depends(role_required(["admin"])),
):
    record = mock_production_db.get(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Production record '{record_id}' not found.")
    if record.status != ProductionStatus.approved:
        raise HTTPException(status_code=400, detail="Only approved records can be deleted by admin.")
    del mock_production_db[record_id]
    return

# --- Supervisor Approval APIs ---

@router.post("/{record_id}/approve", status_code=status.HTTP_200_OK, summary="Approve Production Record (Supervisor)")
async def approve_production_record(
    record_id: str,
    current_user: UserResponse = Depends(role_required(["supervisor"])),
):
    record = mock_production_db.get(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.status != ProductionStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending records can be approved")
    record.status = ProductionStatus.approved
    mock_production_db[record_id] = record
    return {"message": "Production data approved"}

@router.post("/{record_id}/reject", status_code=status.HTTP_200_OK, summary="Reject Production Record (Supervisor)")
async def reject_production_record(
    record_id: str,
    current_user: UserResponse = Depends(role_required(["supervisor"])),
):
    record = mock_production_db.get(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.status != ProductionStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending records can be rejected")
    record.status = ProductionStatus.rejected
    mock_production_db[record_id] = record
    return {"message": "Production data rejected"}

# --- The rest: CSV export

@router.get("/download-csv", summary="Download Production Records as CSV")
async def download_production_csv(
    product_name: Optional[str] = Query(None),
    machine_id: Optional[str] = Query(None),
    operator_id: Optional[str] = Query(None),
    quality_status: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None, description="Filter records starting from this date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Filter records ending up to this date (YYYY-MM-DD)"),
    sort_by: Optional[str] = Query("start_time"),
    sort_order: Optional[str] = Query("desc"),
    current_user: UserResponse = Depends(role_required(["supervisor", "admin"])) # Roles allowed to download
    # db=Depends(get_database) # No longer needed for mock DB
):
    """
    Downloads production records in CSV format, applying optional filters and sorting.
    Requires 'operator', 'supervisor', 'admin', or 'viewer' role.
    """
    # Use the mock_production_db instead of db["production_records"]
    all_records = list(mock_production_db.values())
    records_to_export = []

    # Apply the same filtering logic as get_all_production_records
    for record in all_records:
        match = True
        if product_name and product_name.lower() not in record.product_name.lower():
            match = False
        if match and machine_id and machine_id.lower() not in record.machine_id.lower():
            match = False
        if match and operator_id and operator_id.lower() not in record.operator_id.lower():
            match = False
        if match and quality_status and record.quality_status != quality_status:
            match = False
        if match and start_date and record.start_time.date() < start_date:
            match = False
        if match and end_date and record.end_time.date() > end_date:
            match = False

        if match:
            records_to_export.append(record)

    print(f"DEBUG: Download request filters received: {{'product_name': {product_name}, 'machine_id': {machine_id}, 'operator_id': {operator_id}, 'quality_status': {quality_status}, 'start_date': {start_date}, 'end_date': {end_date}}}")
    print(f"DEBUG: Number of records fetched from mock DB: {len(records_to_export)}")

    # Apply the same sorting logic as get_all_production_records
    valid_sort_fields = [
        "product_name", "machine_id", "operator_id",
        "quantity_produced", "start_time", "end_time", "quality_status", "notes", "id" # Added 'notes', 'id' for CSV export
    ]
    if sort_by not in valid_sort_fields:
        sort_by = "start_time"

    if sort_by:
        if sort_by in ["start_time", "end_time"]:
            records_to_export.sort(
                key=lambda x: make_datetime_aware(getattr(x, sort_by)),
                reverse=(sort_order.lower() == "desc")
            )
        else:
            records_to_export.sort(
                key=lambda x: getattr(x, sort_by),
                reverse=(sort_order.lower() == "desc")
            )


    # Prepare CSV in-memory
    output = io.StringIO()
    fieldnames = [
        "id", "product_name", "machine_id", "operator_id",
        "quantity_produced", "start_time", "end_time", "quality_status", "notes"
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)

    writer.writeheader()
    for record in records_to_export: # Iterate over ProductionRecord objects
        row = {
            "id": record.id,
            "product_name": record.product_name,
            "machine_id": record.machine_id,
            "operator_id": record.operator_id,
            "quantity_produced": record.quantity_produced,
            "start_time": record.start_time.isoformat() if record.start_time else "",
            "end_time": record.end_time.isoformat() if record.end_time else "",
            "quality_status": record.quality_status,
            "notes": record.notes if record.notes is not None else "", # Handle None notes
        }
        writer.writerow(row)

    output.seek(0)

    filename = f"production_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    print(f"DEBUG: CSV content length: {len(output.getvalue())} bytes")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
# --- Reports & Dashboard Endpoints for Production Data ---
# All these will also require 'supervisor' or 'admin'

class DailySummary(BaseModel):
    date: date
    total_quantity_produced: int
    num_records: int
    products: Dict[str, int]
    machines: Dict[str, int]
    quality_pass_rate: float # Percentage 0-100

@router.get(
    "/reports/daily_summary",
    response_model=List[DailySummary],
    summary="Get Daily Production Summary"
)
async def get_daily_production_summary(
    summary_date: Optional[date] = Query(None),
    current_user: UserResponse = Depends(role_required(["supervisor", "admin"])) # SUPERVISOR OR ADMIN
):
    """
    Provides a summary of production activities for a given day.
    If no date is provided, returns summaries for all available days.
    Requires 'supervisor' or 'admin' role.
    """
    daily_summaries: Dict[date, Dict[str, Any]] = {}

    for record in mock_production_db.values():
        record_date = record.start_time.date()
        if summary_date and record_date != summary_date:
            continue

        if record_date not in daily_summaries:
            daily_summaries[record_date] = {
                "date": record_date,
                "total_quantity_produced": 0,
                "num_records": 0,
                "products": {},
                "machines": {},
                "passed_count": 0,
                "total_count": 0,
            }

        daily_summaries[record_date]["total_quantity_produced"] += record.quantity_produced
        daily_summaries[record_date]["num_records"] += 1
        daily_summaries[record_date]["products"][record.product_name] = \
            daily_summaries[record_date]["products"].get(record.product_name, 0) + record.quantity_produced
        daily_summaries[record_date]["machines"][record.machine_id] = \
            daily_summaries[record_date]["machines"].get(record.machine_id, 0) + record.quantity_produced

        daily_summaries[record_date]["total_count"] += 1
        if record.quality_status == "Passed":
            daily_summaries[record_date]["passed_count"] += 1

    result_list = []
    for summary_data in daily_summaries.values():
        total_count = summary_data["total_count"]
        passed_count = summary_data["passed_count"]
        quality_pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0
        result_list.append(DailySummary(
            date=summary_data["date"],
            total_quantity_produced=summary_data["total_quantity_produced"],
            num_records=summary_data["num_records"],
            products=summary_data["products"],
            machines=summary_data["machines"],
            quality_pass_rate=round(quality_pass_rate, 2)
        ))
    return sorted(result_list, key=lambda x: x.date)


class MonthlySummary(BaseModel):
    year_month: str # YYYY-MM
    total_quantity_produced: int
    num_records: int
    quality_pass_rate: float
    top_products: Dict[str, int]
    top_machines: Dict[str, int]

@router.get(
    "/reports/monthly_summary",
    response_model=List[MonthlySummary],
    summary="Get Monthly Production Summary"
)
async def get_monthly_production_summary(
    year: Optional[int] = Query(None, description="Filter by year (e.g., 2025)"),
    month: Optional[int] = Query(None, description="Filter by month (1-12)"),
    current_user: UserResponse = Depends(role_required(["supervisor", "admin"])) # SUPERVISOR OR ADMIN
):
    """
    Provides a summary of production activities for a given month/year.
    If no filters, returns summaries for all available months.
    Requires 'supervisor' or 'admin' role.
    """
    monthly_summaries: Dict[str, Dict[str, Any]] = {}

    for record in mock_production_db.values():
        record_year_month = record.start_time.strftime("%Y-%m")

        if year and record.start_time.year != year:
            continue
        if month and record.start_time.month != month:
            continue

        if record_year_month not in monthly_summaries:
            monthly_summaries[record_year_month] = {
                "year_month": record_year_month,
                "total_quantity_produced": 0,
                "num_records": 0,
                "passed_count": 0,
                "total_count": 0,
                "products_agg": {}, # Temporary aggregation for top_products
                "machines_agg": {}, # Temporary aggregation for top_machines
            }

        summary = monthly_summaries[record_year_month]
        summary["total_quantity_produced"] += record.quantity_produced
        summary["num_records"] += 1
        summary["products_agg"][record.product_name] = \
            summary["products_agg"].get(record.product_name, 0) + record.quantity_produced
        summary["machines_agg"][record.machine_id] = \
            summary["machines_agg"].get(record.machine_id, 0) + record.quantity_produced

        summary["total_count"] += 1
        if record.quality_status == "Passed":
            summary["passed_count"] += 1

    result_list = []
    for summary_data in monthly_summaries.values():
        total_count = summary_data["total_count"]
        passed_count = summary_data["passed_count"]
        quality_pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0

        top_products = dict(sorted(summary_data["products_agg"].items(), key=lambda item: item[1], reverse=True)[:3])
        top_machines = dict(sorted(summary_data["machines_agg"].items(), key=lambda item: item[1], reverse=True)[:3])

        result_list.append(MonthlySummary(
            year_month=summary_data["year_month"],
            total_quantity_produced=summary_data["total_quantity_produced"],
            num_records=summary_data["num_records"],
            quality_pass_rate=round(quality_pass_rate, 2),
            top_products=top_products,
            top_machines=top_machines,
        ))
    return sorted(result_list, key=lambda x: x.year_month)


class MachinePerformance(BaseModel):
    machine_id: str
    total_quantity_produced: int
    average_quantity_per_record: float
    total_production_time_minutes: float
    quality_pass_rate: float
    num_records: int

@router.get(
    "/reports/machine_performance",
    response_model=List[MachinePerformance],
    summary="Get Machine Performance Summary"
)
async def get_machine_performance_summary(
    machine_id: Optional[str] = Query(None, description="Filter by specific machine ID"),
    start_date: Optional[date] = Query(None, description="Filter by production start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Filter by production end date (YYYY-MM-DD)"),
    current_user: UserResponse = Depends(role_required(["supervisor", "admin"])) # SUPERVISOR OR ADMIN
):
    """
    Provides a performance summary for machines, with optional filters.
    Requires 'supervisor' or 'admin' role.
    """
    machine_summaries: Dict[str, Dict[str, Any]] = {}

    for record in mock_production_db.values():
        if machine_id and record.machine_id != machine_id:
            continue
        if start_date and record.start_time.date() < start_date:
            continue
        if end_date and record.end_time.date() > end_date:
            continue

        if record.machine_id not in machine_summaries:
            machine_summaries[record.machine_id] = {
                "machine_id": record.machine_id,
                "total_quantity_produced": 0,
                "total_production_time_minutes": 0.0,
                "passed_count": 0,
                "total_count": 0,
                "num_records": 0,
            }

        summary = machine_summaries[record.machine_id]
        summary["total_quantity_produced"] += record.quantity_produced
        summary["num_records"] += 1
        # Calculate production time in minutes
        time_delta = record.end_time - record.start_time
        summary["total_production_time_minutes"] += time_delta.total_seconds() / 60

        summary["total_count"] += 1
        if record.quality_status == "Passed":
            summary["passed_count"] += 1

    result_list = []
    for summary_data in machine_summaries.values():
        total_quantity_produced = summary_data["total_quantity_produced"]
        num_records = summary_data["num_records"]
        total_count = summary_data["total_count"]
        passed_count = summary_data["passed_count"]

        average_quantity_per_record = (total_quantity_produced / num_records) if num_records > 0 else 0
        quality_pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0

        result_list.append(MachinePerformance(
            machine_id=summary_data["machine_id"],
            total_quantity_produced=total_quantity_produced,
            average_quantity_per_record=round(average_quantity_per_record, 2),
            total_production_time_minutes=round(summary_data["total_production_time_minutes"], 2),
            quality_pass_rate=round(quality_pass_rate, 2),
            num_records=num_records
        ))
    return sorted(result_list, key=lambda x: x.machine_id)


# --- Dashboard Endpoints for Production Data ---

class ProductionOverview(BaseModel):
    total_products_produced: int
    total_production_records: int
    average_quantity_per_record: float
    overall_quality_pass_rate: float
    unique_products: int
    unique_machines: int
    unique_operators: int

@router.get(
    "/dashboard/overview",
    response_model=ProductionOverview,
    summary="Get Production Overview"
)
async def get_production_overview(
    current_user: UserResponse = Depends(role_required(["supervisor", "admin"])) # SUPERVISOR OR ADMIN
):
    """
    Provides a high-level overview of all production activities.
    Requires 'supervisor' or 'admin' role.
    """
    total_products_produced = 0
    total_production_records = len(mock_production_db)
    total_passed_quality = 0
    unique_products = set()
    unique_machines = set()
    unique_operators = set()

    for record in mock_production_db.values():
        total_products_produced += record.quantity_produced
        if record.quality_status == "Passed":
            total_passed_quality += 1
        unique_products.add(record.product_name)
        unique_machines.add(record.machine_id)
        unique_operators.add(record.operator_id)

    average_quantity_per_record = (total_products_produced / total_production_records) if total_production_records > 0 else 0
    overall_quality_pass_rate = (total_passed_quality / total_production_records * 100) if total_production_records > 0 else 0

    return ProductionOverview(
        total_products_produced=total_products_produced,
        total_production_records=total_production_records,
        average_quantity_per_record=round(average_quantity_per_record, 2),
        overall_quality_pass_rate=round(overall_quality_pass_rate, 2),
        unique_products=len(unique_products),
        unique_machines=len(unique_machines),
        unique_operators=len(unique_operators)
    )

class ProductSummary(BaseModel):
    product_name: str
    total_quantity_produced: int
    num_records: int
    quality_pass_rate: float
    machines_used: List[str]

@router.get(
    "/dashboard/product_summary",
    response_model=List[ProductSummary],
    summary="Get Product Production Summary"
)
async def get_product_production_summary(
    product_name: Optional[str] = Query(None),
    current_user: UserResponse = Depends(role_required(["supervisor", "admin"])) # SUPERVISOR OR ADMIN
):
    """
    Provides a summary of production for each product.
    Occasionally filter by a specific product name.
    Requires 'supervisor' or 'admin' role.
    """
    product_summaries: Dict[str, Dict[str, Any]] = {}

    for record in mock_production_db.values():
        if product_name and record.product_name != product_name:
            continue

        if record.product_name not in product_summaries:
            product_summaries[record.product_name] = {
                "product_name": record.product_name,
                "total_quantity_produced": 0,
                "num_records": 0,
                "passed_count": 0,
                "total_count": 0,
                "machines_used": set(),
            }

        summary = product_summaries[record.product_name]
        summary["total_quantity_produced"] += record.quantity_produced
        summary["num_records"] += 1
        summary["machines_used"].add(record.machine_id)
        summary["total_count"] += 1
        if record.quality_status == "Passed":
            summary["passed_count"] += 1

    result_list = []
    for summary_data in product_summaries.values():
        total_count = summary_data["total_count"]
        passed_count = summary_data["passed_count"]
        quality_pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0

        result_list.append(ProductSummary(
            product_name=summary_data["product_name"],
            total_quantity_produced=summary_data["total_quantity_produced"],
            num_records=summary_data["num_records"],
            quality_pass_rate=round(quality_pass_rate, 2),
            machines_used=sorted(list(summary_data["machines_used"]))
        ))
    return sorted(result_list, key=lambda x: x.product_name)


class OperatorSummary(BaseModel):
    operator_id: str
    total_quantity_produced: int
    num_records: int
    quality_pass_rate: float
    products_handled: List[str]
    machines_operated: List[str]

@router.get(
    "/dashboard/operator_summary",
    response_model=List[OperatorSummary],
    summary="Get Operator Production Summary"
)
async def get_operator_production_summary(
    operator_id: Optional[str] = Query(None),
    current_user: UserResponse = Depends(role_required(["supervisor", "admin"])) # SUPERVISOR OR ADMIN
):
    """
    Provides a summary of production activities for each operator.
    Optionally filter by a specific operator ID.
    Requires 'supervisor' or 'admin' role.
    """
    operator_summaries: Dict[str, Dict[str, Any]] = {}

    for record in mock_production_db.values():
        if operator_id and record.operator_id != operator_id:
            continue

        if record.operator_id not in operator_summaries:
            operator_summaries[record.operator_id] = {
                "operator_id": record.operator_id,
                "total_quantity_produced": 0,
                "num_records": 0,
                "passed_count": 0,
                "total_count": 0,
                "products_handled": set(),
                "machines_operated": set(),
            }

        summary = operator_summaries[record.operator_id]
        summary["total_quantity_produced"] += record.quantity_produced
        summary["num_records"] += 1
        summary["products_handled"].add(record.product_name)
        summary["machines_operated"].add(record.machine_id)
        summary["total_count"] += 1
        if record.quality_status == "Passed":
            summary["passed_count"] += 1

    result_list = []
    for summary_data in operator_summaries.values():
        total_count = summary_data["total_count"]
        passed_count = summary_data["passed_count"]
        quality_pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0

        result_list.append(OperatorSummary(
            operator_id=summary_data["operator_id"],
            total_quantity_produced=summary_data["total_quantity_produced"],
            num_records=summary_data["num_records"],
            quality_pass_rate=round(quality_pass_rate, 2),
            products_handled=sorted(list(summary_data["products_handled"])),
            machines_operated=sorted(list(summary_data["machines_operated"])),
        ))
    return sorted(result_list, key=lambda x: x.operator_id)