import io
import zipfile
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from services.gemini_service import generate_content

router = APIRouter()

# In-memory store for active sessions
docs_sessions = {}

class ChatRequest(BaseModel):
    session_id: str
    message: str
    is_compact_mode: bool = False

def is_text_file(filename: str) -> bool:
    """Basic check to ignore binaries and common ignore paths."""
    ignore_dirs = ['node_modules/', '.git/', 'venv/', '__pycache__/', 'dist/', 'build/', '.next/']
    ignore_exts = ['.jpg', '.png', '.gif', '.mp4', '.pdf', '.exe', '.dll', '.so', '.dylib', '.pyc']
    
    if any(filename.startswith(d) or f"/{d}" in filename for d in ignore_dirs):
        return False
    if any(filename.endswith(ext) for ext in ignore_exts):
        return False
    return True

@router.post("/analyze")
async def analyze_repository(file: UploadFile = File(...), is_compact_mode: bool = Form(False)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files are supported.")
    
    try:
        # Read the zip file into memory (ephemeral storage)
        content = await file.read()
        zip_file = zipfile.ZipFile(io.BytesIO(content))
        
        repo_text = ""
        file_count = 0
        
        # Extract and format codebase context
        for file_info in zip_file.infolist():
            if file_info.is_dir() or not is_text_file(file_info.filename):
                continue
                
            try:
                with zip_file.open(file_info) as f:
                    file_content = f.read().decode('utf-8')
                    # Concatenate with clear file markers
                    repo_text += f"\n\n--- FILE: {file_info.filename} ---\n\n"
                    repo_text += file_content
                    file_count += 1
            except UnicodeDecodeError:
                # Skip binary files that slipped through the extension check
                pass
                
        if file_count == 0:
            raise HTTPException(status_code=400, detail="No readable text files found in the zip.")
            
        # Construct the massive prompt for Gemini
        prompt = f"""
You are an expert AI Software Engineering Assistant. 
I am providing you with the complete source code of a software project.
Your task is to generate highly professional, enterprise-grade technical documentation for this codebase.

The documentation MUST include:
1. Executive Summary (Project purpose, architecture)
2. Technology Stack used and why
3. Folder Structure explanation
4. Key File & Business Logic Documentation
6. Mermaid Diagrams (e.g., architecture, sequence, or ER diagrams) wrapped in ```mermaid blocks.

CRITICAL RULES FOR MERMAID DIAGRAMS:
- Node IDs MUST NOT contain spaces. Use underscores (e.g. `App_Router` instead of `App Router`).
- You MUST use square brackets for node shapes (e.g. `id["Label"]`). NEVER use parentheses for node shapes.
- Node labels MUST NOT contain parentheses or special characters. (e.g. use `id["Web Audio API"]` instead of `id["Web Audio API (Browser)"]`).
- Edge labels MUST NOT contain special characters like parentheses or brackets. (e.g. use `-->|API Request|` instead of `-->|API Request (HTTP/WS)|`).
- DO NOT use any HTML tags inside node labels.

Make it clean, beginner-friendly yet technically deep. Use markdown formatting.

Here is the codebase ({file_count} files):
{repo_text[:1000000]} # Limit to ~1M characters for safety, Gemini 1.5 Pro can handle much more though.
"""
        if is_compact_mode:
            prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS ON. You MUST generate a very brief and concise document with only the most essential points."
        else:
            prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS OFF. You MUST generate a highly detailed and comprehensive document explaining everything in depth."
        
        # Store in memory
        session_id = str(uuid.uuid4())
        docs_sessions[session_id] = repo_text[:1000000] # store the truncated context
        
        # Call Gemini Service
        documentation = await generate_content(prompt)
        
        return {
            "status": "success",
            "session_id": session_id,
            "files_analyzed": file_count,
            "documentation": documentation
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat_with_codebase(request: ChatRequest):
    """Sends user message and codebase context to Gemini."""
    if request.session_id not in docs_sessions:
        raise HTTPException(status_code=404, detail="Session expired or not found. Please re-upload the repository.")
        
    codebase_context = docs_sessions[request.session_id]
    
    prompt = f"""
You are an elite Senior Software Engineer and Codebase Architect.
You have been given the following complete source code context for a project:

--- CODEBASE START ---
{codebase_context}
--- CODEBASE END ---

The user says: "{request.message}"

Please respond professionally, explaining reasoning, trade-offs, and providing specific code snippets from the context where appropriate. Use bullet points and structured markdown.
"""

    if request.is_compact_mode:
        prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS ON. You MUST be extremely brief, concise, and provide only the essential information without any deep explanations."
    else:
        prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS OFF. You MUST be highly detailed, comprehensive, and deeply explain every concept and code snippet clearly."

    try:
        response = await generate_content(prompt)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
