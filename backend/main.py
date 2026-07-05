from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import docs_generator, requirements_analyzer, planner, sessions
import models
from database import engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DevPilot AI Backend",
    description="Backend API for the DevPilot AI Software Engineering Assistant.",
    version="1.0.0",
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local dev across network
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(docs_generator.router, prefix="/api/v1/docs", tags=["Docs Generator"])
app.include_router(requirements_analyzer.router, prefix="/api/v1/requirements", tags=["Requirements Analyzer"])
app.include_router(planner.router, prefix="/api/v1/planner", tags=["Project Planner"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["Sessions"])

@app.get("/")
def root():
    return {"message": "DevPilot API is running! Please open the frontend at http://localhost:3000"}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "DevPilot AI"}
