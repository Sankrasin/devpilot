import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.gemini_service import generate_content

router = APIRouter()

# In-memory store for active sessions
planner_sessions = {}

class PlannerRequest(BaseModel):
    idea: str
    is_compact_mode: bool = False

class ChatRequest(BaseModel):
    session_id: str
    message: str
    is_compact_mode: bool = False

@router.post("/generate")
async def generate_project_plan(request: PlannerRequest):
    """Generates a complete project plan from a simple idea."""
    if not request.idea.strip():
        raise HTTPException(status_code=400, detail="Project idea cannot be empty.")
        
    prompt = f"""
You are an elite Software Architecture AI and Technical Project Manager.
The user wants to build the following software:
"{request.idea}"

Generate a complete, production-ready execution plan for this software project.
Format your response in Markdown with the following strict sections:

## Project Overview
(Objectives, Scope, Features, User Roles)

## Tech Stack Recommendations
(Frontend, Backend, Database, Auth, Deployment with reasons)

## System Architecture
(Provide a comprehensive ```mermaid graph TD diagram showing the flow between components)

## Database Schema
(Provide a ```mermaid erDiagram showing tables and relationships)

CRITICAL RULES FOR MERMAID DIAGRAMS:
- Node IDs MUST NOT contain spaces. Use underscores (e.g. `App_Router` instead of `App Router`).
- You MUST use square brackets for node shapes (e.g. `id["Label"]`). NEVER use parentheses for node shapes.
- Node labels MUST NOT contain parentheses or special characters. (e.g. use `id["Web Audio API"]` instead of `id["Web Audio API (Browser)"]`).
- Edge labels MUST NOT contain special characters like parentheses or brackets. (e.g. use `-->|API Request|` instead of `-->|API Request (HTTP/WS)|`).
- DO NOT use any HTML tags inside node labels.

## API Design
(List 3-5 core REST or GraphQL endpoints needed)

## Sprint Planning (First 4 Weeks)
(Break down the work into 4 weekly sprints with clear deliverables)

## Risks & Security
(Identify potential scaling bottlenecks and security considerations)

Keep the response highly structured, extremely professional, and deeply technical but easy to read.
"""

    if request.is_compact_mode:
        prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS ON. You MUST generate a very brief and concise plan with only the most essential points."
    else:
        prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS OFF. You MUST generate a highly detailed and comprehensive plan explaining everything in depth."

    try:
        plan_content = await generate_content(prompt)
        
        session_id = str(uuid.uuid4())
        planner_sessions[session_id] = {
            "idea": request.idea,
            "plan": plan_content
        }
        
        return {
            "status": "success",
            "session_id": session_id,
            "plan": plan_content
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat_with_planner(request: ChatRequest):
    """Sends user message and project plan context to Gemini."""
    if request.session_id not in planner_sessions:
        raise HTTPException(status_code=404, detail="Session expired or not found. Please start a new project plan.")
        
    context = planner_sessions[request.session_id]
    
    prompt = f"""
You are an elite Software Architecture AI and Technical Project Manager.
The user previously asked you to build the following software:
"{context['idea']}"

And you generated the following architectural plan:
--- PLAN START ---
{context['plan']}
--- PLAN END ---

The user says: "{request.message}"

Please respond professionally, updating the plan or answering the user's questions. 
If the user asks for changes, provide the modified sections using structured markdown. 
CRITICAL RULES FOR MERMAID DIAGRAMS:
- Node IDs MUST NOT contain spaces. Use underscores (e.g. `App_Router` instead of `App Router`).
- You MUST use square brackets for node shapes (e.g. `id["Label"]`). NEVER use parentheses for node shapes.
- Node labels MUST NOT contain parentheses or special characters. (e.g. use `id["Web Audio API"]` instead of `id["Web Audio API (Browser)"]`).
- Edge labels MUST NOT contain special characters like parentheses or brackets. (e.g. use `-->|API Request|` instead of `-->|API Request (HTTP/WS)|`).
- DO NOT use any HTML tags inside node labels.
"""

    if request.is_compact_mode:
        prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS ON. You MUST be extremely brief, concise, and provide only the essential information without any deep explanations."
    else:
        prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS OFF. You MUST be highly detailed, comprehensive, and deeply explain every concept and code snippet clearly."

    try:
        response = await generate_content(prompt)
        
        # We append the response to the context plan to keep memory persistent
        planner_sessions[request.session_id]['plan'] += f"\n\n### Update based on user request ({request.message}):\n{response}"
        
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
