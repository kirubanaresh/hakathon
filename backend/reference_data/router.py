# backend/reference_data/router.py

from fastapi import APIRouter, HTTPException, status, Body
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

router = APIRouter(
    prefix="/reference-data/reference_data", # Matches the full path you listed
    tags=["Reference Data"],
)

# --- Pydantic Models for Reference Data ---

class ReferenceDataItem(BaseModel):
    """
    Represents a single item within a reference data category.
    """
    id: str = Field(..., example="item_1", description="Unique ID for the reference data item")
    value: str = Field(..., example="Option A", description="Display value of the reference data item")
    description: Optional[str] = Field(None, example="First option in the list", description="Optional description for the item")

class ReferenceDataCategory(BaseModel):
    """
    Represents a reference data category with a list of items.
    """
    name: str = Field(..., example="document_types", description="Unique name of the reference data category")
    description: Optional[str] = Field(None, example="Types of documents used in the system", description="Description of the category")
    items: List[ReferenceDataItem] = Field(default_factory=list, description="List of items within this category")

class ReferenceDataCategoryCreate(BaseModel):
    """
    Model for creating a new reference data category.
    """
    name: str = Field(..., example="product_types", description="Unique name for the new category")
    description: Optional[str] = Field(None, example="Different types of products manufactured", description="Optional description for the new category")
    items: List[ReferenceDataItem] = Field(default_factory=list, description="Initial list of items for the new category")

class ReferenceDataCategoryUpdate(BaseModel):
    """
    Model for updating an existing reference data category.
    All fields are optional, meaning you only send what you want to change.
    """
    description: Optional[str] = Field(None, example="Updated description for documents", description="New description for the category")
    items: Optional[List[ReferenceDataItem]] = Field(None, description="New list of items for the category (replaces existing items)")


# --- In-memory "Database" for demonstration ---
# In a real application, this would interact with a persistent database (SQLAlchemy, MongoDB, etc.)
mock_reference_data_db: Dict[str, ReferenceDataCategory] = {
    "document_types": ReferenceDataCategory(
        name="document_types",
        description="Types of documents for records",
        items=[
            ReferenceDataItem(id="invoice", value="Invoice"),
            ReferenceDataItem(id="receipt", value="Receipt"),
            ReferenceDataItem(id="report", value="Report"),
        ]
    ),
    "status_codes": ReferenceDataCategory(
        name="status_codes",
        description="Common status codes for processes",
        items=[
            ReferenceDataItem(id="active", value="Active"),
            ReferenceDataItem(id="inactive", value="Inactive"),
            ReferenceDataItem(id="pending", value="Pending"),
        ]
    ),
}

# --- API Endpoints ---

@router.get(
    "/",
    response_model=List[ReferenceDataCategory],
    summary="Get All Reference Data Categories"
)
async def get_all_reference_data_categories():
    """
    Retrieves a list of all available reference data categories.
    """
    return list(mock_reference_data_db.values())

@router.post(
    "/",
    response_model=ReferenceDataCategory,
    status_code=status.HTTP_201_CREATED,
    summary="Create Reference Data Category"
)
async def create_reference_data_category(
    category: ReferenceDataCategoryCreate = Body(...)
):
    """
    Creates a new reference data category.

    - **name**: Unique name for the category (e.g., 'product_types').
    - **description**: Optional description.
    - **items**: Initial list of reference data items.
    """
    if category.name in mock_reference_data_db:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Reference data category '{category.name}' already exists."
        )
    new_category = ReferenceDataCategory(**category.model_dump())
    mock_reference_data_db[new_category.name] = new_category
    return new_category

@router.get(
    "/{category_name}",
    response_model=ReferenceDataCategory,
    summary="Get Reference Data By Name"
)
async def get_reference_data_by_name(category_name: str):
    """
    Retrieves a single reference data category by its unique name.

    - **category_name**: The name of the category to retrieve.
    """
    category = mock_reference_data_db.get(category_name)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reference data category '{category_name}' not found."
        )
    return category

@router.put(
    "/{category_name}",
    response_model=ReferenceDataCategory,
    summary="Update Reference Data Category"
)
async def update_reference_data_category(
    category_name: str,
    category_update: ReferenceDataCategoryUpdate = Body(...)
):
    """
    Updates an existing reference data category.

    - **category_name**: The name of the category to update.
    - **description**: New description (optional).
    - **items**: New list of items (replaces existing items, optional).
    """
    category = mock_reference_data_db.get(category_name)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reference data category '{category_name}' not found."
        )

    update_data = category_update.model_dump(exclude_unset=True)
    updated_category = category.model_copy(update=update_data) # Use model_copy for Pydantic v2
    mock_reference_data_db[category_name] = updated_category
    return updated_category

@router.delete(
    "/{category_name}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Reference Data Category"
)
async def delete_reference_data_category(category_name: str):
    """
    Deletes a reference data category by its unique name.

    - **category_name**: The name of the category to delete.
    """
    if category_name not in mock_reference_data_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reference data category '{category_name}' not found."
        )
    del mock_reference_data_db[category_name]
    return {"message": "Category deleted successfully"} # FastAPI requires a return, even for 204