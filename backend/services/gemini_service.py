import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini API
API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not found in environment variables.")

# Recommend using Gemini 2.5 Flash as it is readily available on the free tier
MODEL_NAME = "gemini-2.5-flash"

def get_gemini_model():
    # Initialize the model with specific parameters if needed
    return genai.GenerativeModel(MODEL_NAME)

async def generate_content(prompt: str, context_files: list = None):
    """
    Generates content using Gemini. 
    Accepts an optional list of context files (for the codebase parsing feature).
    """
    model = get_gemini_model()
    
    # If we have file objects (e.g. from File API), we can pass them here.
    # For now, we will handle text prompts directly.
    # A real implementation would upload files to the Gemini File API first for large repos.
    
    response = model.generate_content(prompt)
    return response.text
