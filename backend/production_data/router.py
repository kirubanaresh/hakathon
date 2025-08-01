# backend/routers/production_data.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorCollection
from bson import ObjectId
from typing import List, Optional
from datetime import datetime, date, timedelta, timezone

# Import schemas (ensure UserInDB is also imported for type hinting)
from ..schemas import (
    ProductionDataCreate,
    ProductionDataResponse,
    ProductionDataUpdate,
    ProductionDataFilter,
    UserInDB, # <--- CHANGED FROM UserResponse to UserInDB for consistency
    DailyProductionSummary,
    MonthlyProductionSummary,
    MachinePerformanceSummary,
    ProductionOverviewSummary,
    ProductProductionSummary,
    OperatorProductionSummary
)

# Import database connection dependency and security dependencies
from ..database import get_database # <--- CHANGED: Import get_database
from ..auth.security import get_current_active_user, role_required

router = APIRouter(
    prefix="/production_data",
    tags=["Production Data"],
)

# Dependency to get the production data collection (using get_database)
async def get_production_data_collection(db=Depends(get_database)) -> AsyncIOMotorCollection:
    """Dependency function to provide the production data collection."""
    return db["production_data"] # Get the collection from the database instance

STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
# --- CRUD Operations for Production Data ---

@router.post("/", response_model=ProductionDataResponse, status_code=status.HTTP_201_CREATED)
async def create_production_record(
    record_in: ProductionDataCreate,
    current_user: UserInDB = Depends(role_required(["admin", "operator"])),  # Only admin or operator can create
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
):
    """
    Creates a new production data record.
    Status is forcibly set to 'pending' regardless of client input.
    """

    # Convert input model to dict
    record_data = record_in.model_dump(by_alias=True, exclude_unset=True)

    # Force status field to 'pending' ignoring any client input
    record_data["status"] = "pending"
     # Debug prints for connection and data
    print(f"Using DB: {collection.database.name}, Collection: {collection.name}")
    print(f"Inserting record: {record_data}")

    # Insert into DB
    result = await collection.insert_one(record_data)
    
    print(f"Inserted document ID: {result.inserted_id}")
    

    # Fetch inserted record
    created_record = await collection.find_one({"_id": result.inserted_id})

    if created_record is None:
        raise HTTPException(status_code=500, detail="Failed to create production record.")

    return ProductionDataResponse(**created_record)

@router.get("/", response_model=List[ProductionDataResponse])
async def get_all_production_records(
    current_user: UserInDB = Depends(get_current_active_user),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
    skip: int = Query(0, description="Number of records to skip for pagination"),
    limit: int = Query(100, description="Maximum number of records to return for pagination"),
    productName: Optional[str] = None,
    machineId: Optional[str] = None,
    operatorId: Optional[str] = None,
    shift: Optional[str] = None,
    minQuantity: Optional[int] = None,
    maxQuantity: Optional[int] = None,
    startDate: Optional[date] = None,
    endDate: Optional[date] = None,
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected"),
):
    """
    Get all production data records with optional filters and pagination.
    Role-based access:
      - Admin: Only approved records (or requested status if allowed).
      - Supervisor: pending and approved records (or requested status if allowed).
      - Operator: Only own records (operatorId) regardless of status or filtered by allowed status.
    """
    query = {}

    # Apply filter parameters
    if productName:
        query["productName"] = productName
    if machineId:
        query["machineId"] = machineId
    if operatorId:
        query["operatorId"] = operatorId
    if shift:
        query["shift"] = shift
    if minQuantity is not None or maxQuantity is not None:
        quantity_range = {}
        if minQuantity is not None:
            quantity_range["$gte"] = minQuantity
        if maxQuantity is not None:
            quantity_range["$lte"] = maxQuantity
        query["quantityProduced"] = quantity_range
    if startDate is not None or endDate is not None:
        date_range = {}
        if startDate is not None:
            date_range["$gte"] = datetime.combine(startDate, datetime.min.time(), tzinfo=timezone.utc)
        if endDate is not None:
            date_range["$lt"] = datetime.combine(endDate + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        query["production_date"] = date_range

    # Role based status filtering
    if "admin" in current_user.roles:
        allowed_statuses = [STATUS_APPROVED]
    elif "supervisor" in current_user.roles:
        allowed_statuses = [STATUS_PENDING, STATUS_APPROVED]
    elif "operator" in current_user.roles:
        allowed_statuses = None
        query["operatorId"] = current_user.username
    else:
        return []

    # Apply status filter param if given, else apply role base filter
    valid_statuses = [STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED]
    if status:
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        if allowed_statuses and status not in allowed_statuses:
            # User not allowed to access this status
            return []
        query["status"] = status
    else:
        if allowed_statuses:
            if len(allowed_statuses) == 1:
                query["status"] = allowed_statuses[0]
            else:
                query["status"] = {"$in": allowed_statuses}

    cursor = collection.find(query).skip(skip).limit(limit).sort("production_date", -1)
    records = await cursor.to_list(length=None)
    return [ProductionDataResponse(**record) for record in records]


@router.get("/{record_id}", response_model=ProductionDataResponse)
async def get_production_record_by_id(
    record_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
):
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid record ID format.")
    record = await collection.find_one({"_id": ObjectId(record_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Production record not found.")

    # Enforce view permissions
    if "admin" in current_user.roles or "supervisor" in current_user.roles:
        return ProductionDataResponse(**record)
    elif "operator" in current_user.roles:
        if record.get("operatorId") == current_user.username:
            return ProductionDataResponse(**record)
        else:
            raise HTTPException(status_code=403, detail="Not authorized to view this record.")
    else:
        raise HTTPException(status_code=403, detail="Not authorized.")


@router.put("/{record_id}", response_model=ProductionDataResponse)
async def update_production_record(
    record_id: str,
    record_update: ProductionDataUpdate,
    current_user: UserInDB = Depends(role_required(["admin"])),  # Only admin can update approved records
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
):
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid record ID format.")

    record = await collection.find_one({"_id": ObjectId(record_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Production record not found.")

    if record.get("status") != STATUS_APPROVED:
        raise HTTPException(status_code=400, detail="Only approved records can be edited by admin.")

    update_data = record_update.model_dump(by_alias=True, exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    await collection.update_one({"_id": ObjectId(record_id)}, {"$set": update_data})

    updated_record = await collection.find_one({"_id": ObjectId(record_id)})
    return ProductionDataResponse(**updated_record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_production_record(
    record_id: str,
    current_user: UserInDB = Depends(role_required(["admin"])),  # Only admin can delete approved records
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
):
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid record ID format.")

    record = await collection.find_one({"_id": ObjectId(record_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Production record not found.")

    if record.get("status") != STATUS_APPROVED:
        raise HTTPException(status_code=400, detail="Only approved records can be deleted.")

    delete_result = await collection.delete_one({"_id": ObjectId(record_id)})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Failed to delete production record.")

    return None  # 204 No Content


# --- Supervisor-specific endpoints ---

@router.post("/{record_id}/approve", status_code=status.HTTP_200_OK)
async def approve_production_record(
    record_id: str,
    current_user: UserInDB = Depends(role_required(["supervisor"])),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
):
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid record ID format.")

    record = await collection.find_one({"_id": ObjectId(record_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Production record not found.")

    if record.get("status") != STATUS_PENDING:
        raise HTTPException(status_code=400, detail="Only pending records can be approved.")

    await collection.update_one({"_id": ObjectId(record_id)}, {"$set": {"status": STATUS_APPROVED}})
    return {"message": "Production data approved."}


@router.post("/{record_id}/reject", status_code=status.HTTP_200_OK)
async def reject_production_record(
    record_id: str,
    current_user: UserInDB = Depends(role_required(["supervisor"])),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
):
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid record ID format.")

    record = await collection.find_one({"_id": ObjectId(record_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Production record not found.")

    if record.get("status") != STATUS_PENDING:
        raise HTTPException(status_code=400, detail="Only pending records can be rejected.")

    await collection.update_one({"_id": ObjectId(record_id)}, {"$set": {"status": STATUS_REJECTED}})
    return {"message": "Production data rejected."}

# --- Aggregation and Reporting Endpoints (for Dashboards) ---

@router.get("/reports/daily_summary", response_model=List[DailyProductionSummary])
async def get_daily_production_summary(
    current_user: UserInDB = Depends(get_current_active_user),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
    start_date: Optional[date] = Query(None, description="Start date for summary (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date for summary (YYYY-MM-DD)"),
):
    """
    Generates a daily production summary (total quantity and record count per day).
    Occasionally filter by date range.
    Accessible to all authenticated active users.
    """
    pipeline = []
    match_stage = {}

    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        if end_date:
            date_filter["$lt"] = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        match_stage["production_date"] = date_filter
    
    if match_stage:
        pipeline.append({"$match": match_stage})

    pipeline.extend([
        {
            "$group": {
                "_id": { "$dateToString": { "format": "%Y-%m-%d", "date": "$production_date" } },
                "totalQuantity": { "$sum": "$quantityProduced" },
                "numRecords": { "$sum": 1 }
            }
        },
        { "$sort": { "_id": 1 } } # Sort by date ascending
    ])

    summary_cursor = collection.aggregate(pipeline)
    summary_list = await summary_cursor.to_list(length=None)
    return [DailyProductionSummary(**item) for item in summary_list]


@router.get("/reports/monthly_summary", response_model=List[MonthlyProductionSummary])
async def get_monthly_production_summary(
    current_user: UserInDB = Depends(get_current_active_user),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
    year: Optional[int] = Query(None, description="Filter by year"),
):
    """
    Generates a monthly production summary (total quantity and record count per month).
    Optionally filter by year.
    Accessible to all authenticated active users.
    """
    pipeline = []
    match_stage = {}
    
    if year:
        match_stage["production_date"] = {
            "$gte": datetime(year, 1, 1, tzinfo=timezone.utc),
            "$lt": datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        }
    
    if match_stage:
        pipeline.append({"$match": match_stage})

    pipeline.extend([
        {
            "$group": {
                "_id": { "$dateToString": { "format": "%Y-%m", "date": "$production_date" } },
                "totalQuantity": { "$sum": "$quantityProduced" },
                "numRecords": { "$sum": 1 }
            }
        },
        { "$sort": { "_id": 1 } } # Sort by year-month ascending
    ])

    summary_cursor = collection.aggregate(pipeline)
    summary_list = await summary_cursor.to_list(length=None)
    return [MonthlyProductionSummary(**item) for item in summary_list]


@router.get("/reports/machine_performance", response_model=List[MachinePerformanceSummary])
async def get_machine_performance_summary(
    current_user: UserInDB = Depends(get_current_active_user),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection),
    machine_id: Optional[str] = Query(None, description="Filter by a specific machine ID")
):
    """
    Generates a summary of production performance per machine.
    Accessible to all authenticated active users.
    """
    pipeline = []
    if machine_id:
        pipeline.append({"$match": {"machineId": machine_id}})

    pipeline.extend([
        {
            "$group": {
                "_id": "$machineId",
                "totalQuantity": { "$sum": "$quantityProduced" },
                "numRecords": { "$sum": 1 },
                "avgTimeTakenMinutes": { "$avg": "$timeTakenMinutes" }
            }
        },
        {
            "$project": {
                "_id": 1,
                "totalQuantity": 1,
                "numRecords": 1,
                "avgTimeTakenMinutes": 1,
                "avgQuantityPerRecord": { "$cond": [{ "$ne": ["$numRecords", 0] }, { "$divide": ["$totalQuantity", "$numRecords"] }, 0] }
            }
        },
        { "$sort": { "totalQuantity": -1 } } # Sort by total quantity descending
    ])

    summary_cursor = collection.aggregate(pipeline)
    summary_list = await summary_cursor.to_list(length=None)
    return [MachinePerformanceSummary(**item) for item in summary_list]


@router.get("/dashboard/overview", response_model=ProductionOverviewSummary)
async def get_production_overview(
    current_user: UserInDB = Depends(get_current_active_user),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection)
):
    """
    Provides a high-level overview of total production quantity and record count.
    Accessible to all authenticated active users.
    """
    pipeline = [
        {
            "$group": {
                "_id": None, # Group all documents
                "totalQuantityOverall": { "$sum": "$quantityProduced" },
                "totalRecordsOverall": { "$sum": 1 }
            }
        },
        { "$project": { "_id": 0, "totalQuantityOverall": 1, "totalRecordsOverall": 1 } }
    ]
    
    result = await collection.aggregate(pipeline).to_list(length=1)
    if result:
        return ProductionOverviewSummary(**result[0])
    return ProductionOverviewSummary(totalQuantityOverall=0, totalRecordsOverall=0)


@router.get("/dashboard/product_summary", response_model=List[ProductProductionSummary])
async def get_product_production_summary(
    current_user: UserInDB = Depends(get_current_active_user),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection)
):
    """
    Aggregates production quantity and records per product.
    Accessible to all authenticated active users.
    """
    pipeline = [
        {
            "$group": {
                "_id": "$productName",
                "totalQuantity": { "$sum": "$quantityProduced" },
                "numRecords": { "$sum": 1 }
            }
        },
        { "$sort": { "totalQuantity": -1 } }
    ]
    summary_cursor = collection.aggregate(pipeline)
    summary_list = await summary_cursor.to_list(length=None)
    return [ProductProductionSummary(**item) for item in summary_list]


@router.get("/dashboard/operator_summary", response_model=List[OperatorProductionSummary])
async def get_operator_production_summary(
    current_user: UserInDB = Depends(get_current_active_user),
    collection: AsyncIOMotorCollection = Depends(get_production_data_collection)
):
    """
    Aggregates production quantity and records per operator.
    Accessible to all authenticated active users.
    """
    pipeline = [
        {
            "$group": {
                "_id": "$operatorId",
                "totalQuantity": { "$sum": "$quantityProduced" },
                "numRecords": { "$sum": 1 }
            }
        },
        { "$sort": { "totalQuantity": -1 } }
    ]
    summary_cursor = collection.aggregate(pipeline)
    summary_list = await summary_cursor.to_list(length=None)
    return [OperatorProductionSummary(**item) for item in summary_list]