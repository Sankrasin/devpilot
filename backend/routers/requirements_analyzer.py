import io
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from pypdf import PdfReader
from services.gemini_service import generate_content

router = APIRouter()

# In-memory store for active sessions to avoid DB/Cloud costs.
# In a true scalable production environment, this would be in Redis.
document_sessions = {}

class ChatRequest(BaseModel):
    session_id: str
    message: str
    is_compact_mode: bool = False

@router.post("/upload")
async def upload_document(file: UploadFile = File(...), is_compact_mode: bool = Form(False)):
    """Uploads a PDF/MD file, extracts text, and initializes an in-memory session."""
    if not (file.filename.endswith('.pdf') or file.filename.endswith('.md')):
        raise HTTPException(status_code=400, detail="Only .pdf or .md files are supported.")
    
    try:
        content = await file.read()
        extracted_text = ""
        
        if file.filename.endswith('.pdf'):
            reader = PdfReader(io.BytesIO(content))
            for page in reader.pages:
                extracted_text += page.extract_text() + "\n"
        else:
            extracted_text = content.decode('utf-8')
            
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Document appears to be empty or unreadable.")
            
        session_id = str(uuid.uuid4())
        document_sessions[session_id] = extracted_text
        
        return {
            "status": "success",
            "session_id": session_id,
            "message": "Document parsed successfully."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat_with_document(request: ChatRequest):
    """Sends user message and document context to Gemini."""
    if request.session_id not in document_sessions:
        raise HTTPException(status_code=404, detail="Session expired or not found. Please re-upload the document.")
        
    document_context = document_sessions[request.session_id]
    
    # We construct a prompt that forces the AI to act as a Senior SE
    prompt = f"""
You are a Senior Software Engineer acting as a Requirements Analyzer.
You have been given the following technical document (SRS/PRD/etc.):

--- DOCUMENT START ---
{document_context[:500000]} # Limit for extremely large files
--- DOCUMENT END ---

The user says: "{request.message}"

Please respond professionally, explaining reasoning, trade-offs, and breaking down concepts where appropriate. Use bullet points and structured markdown.
"""

    if request.is_compact_mode:
        prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS ON. You MUST be extremely brief, concise, and provide only the essential information without any deep explanations."
    else:
        prompt += "\n\nCRITICAL INSTRUCTION: COMPACT MODE IS OFF. You MUST be highly detailed, comprehensive, and deeply explain every concept clearly."

    try:
        response = await generate_content(prompt)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
