# backend/main.py

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
# Import routers from their respective modules
# Ensure these imports match your actual file structure and router variable names
from backend.auth.router import router as auth_router
from backend.routers import users
from backend.routers import notifications
from backend.routers import reports

from backend.production_data.router import router as production_data_router

# IMPORTANT: MongoDB connection imports
from backend.database import connect_to_mongo, close_mongo_connection, ensure_unique_indexes


app = FastAPI(
    title="Your Hackathon Project API", # Customize your API title here
    description="An API for managing users, notifications, reports, and production data.", # Customize your API description
    version="1.0.0", # You can update your API version
    docs_url="/docs", # Default Swagger UI documentation
    redoc_url="/redoc", # Default ReDoc documentation
)

origins = [
    "http://localhost:5173",  # Your React app's development server
    "http://127.0.0.1:5173",
    "http://localhost:8001",  # Sometimes browsers use this loopback address
    # Add other origins if your frontend will be deployed elsewhere, e.g.,
    # "https://your-frontend-domain.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Allows all headers
)

# Optional: Redirect root URL to /docs for easy access
@app.get("/", include_in_schema=False)
async def read_root():
    return RedirectResponse(url="/docs")


# --- MongoDB Connection Lifecycle Events ---
# These functions will run when the FastAPI application starts up and shuts down.
@app.on_event("startup")
async def startup_db_client():
    print("Running MongoDB startup event...") # Added for debugging confirmation
    await connect_to_mongo()
    await ensure_unique_indexes() # Call this to create unique indexes on startup
    print("MongoDB startup event completed.") # Added for debugging confirmation

@app.on_event("shutdown")
async def shutdown_db_client():
    print("Running MongoDB shutdown event...") # Added for debugging confirmation
    await close_mongo_connection()
    print("MongoDB shutdown event completed.") # Added for debugging confirmation


# --- Include Routers ---
# Note on prefixes:
# If a router (e.g., in reports.py) already has a `prefix` defined in its APIRouter creation,
# you should *not* add an additional `prefix` argument when including it here,
# unless you want to nest it further (which caused your /reports/reports issue).

# Authentication Router
app.include_router(auth_router, tags=["Authentication"])

# Users Router
# Assuming backend/routers/users.py has router = APIRouter()
app.include_router(users.router, prefix="/users", tags=["Users"])

# Notifications Router
# Assuming backend/routers/notifications.py has router = APIRouter(prefix="/notifications", ...)
app.include_router(notifications.router, tags=["Notifications"])


# Reports Router (FIXED: No extra prefix here to avoid /reports/reports)
# Assuming backend/routers/reports.py has router = APIRouter(prefix="/reports", ...)
app.include_router(reports.router, tags=["Reports"])

# Production Data Router (FIXED: No extra prefix here)
app.include_router(production_data_router, tags=["Production Data"])
