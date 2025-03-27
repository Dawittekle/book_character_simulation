import hashlib
import json
import logging
import os

import fitz
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain.chat_models import ChatOpenAI

from controllers.character_processor import CharacterProcessor
from controllers.chat_controller import ChatController

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
load_dotenv()

app = Flask(__name__)
CORS(app)

llm = ChatOpenAI(
    model_name="gpt-4", 
    api_key=os.getenv("OPENAI_API_KEY"),
    temperature=0.7
)

chat_controller = ChatController(llm)

def extract_text_from_pdf(file):
    """Extract text from a PDF file using PyMuPDF."""
    text = ""
    pdf_document = fitz.open(stream=file.read(), filetype="pdf")
    for page in pdf_document:
        text += page.get_text("text") + "\n"
    return text.strip()

@app.route('/api/extract-characters', methods=['POST'])
def extract_characters():
    text = ""
    
    if 'file' in request.files:
        file = request.files['file']
        if file.filename and file.filename.lower().endswith('.pdf'):
            text = extract_text_from_pdf(file)
        else:
            return jsonify({"error": "Invalid file type. Only PDFs are allowed."}), 400
    else:
        text = request.form.get('text')
        if not text:
            return jsonify({"error": "No text provided."}), 400

    # Create a hash of the text to act as the unique text_id
    text_id = hashlib.sha256(text.encode('utf-8')).hexdigest()

    character_processor = CharacterProcessor(llm)

    try:
        characters = character_processor.extract_characters(text_id, text)
        if not characters:
            return jsonify({"error": "No characters found."}), 500
        
        result = [{
            **char.dict(),
            "text_id": text_id
        } for char in characters]
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error during character extraction: {str(e)}")
        return jsonify({"error": "An error occurred during character extraction."}), 500

@app.route('/api/chat/<character_id>', methods=['POST'])
def chat_with_character(character_id):
    user_message = request.form.get("message")
    text_id = request.form.get("text_id")
    session_id = request.form.get("session_id")

    if not user_message:
        return jsonify({"error": "No message provided."}), 400
    
    try:
        session_id, reply, updated_psi, emotion_state = chat_controller.chat(character_id, user_message, text_id,session_id)
        
        result = [
            {
            "session_id": session_id,
            "reply": reply,
            "updated_psi": updated_psi,
            "emotion_state": emotion_state
            }
        ]
        return jsonify(result)
    except Exception as e:
        logger.error(f"Chat update failed: {str(e)}")
        return jsonify({"error": "An error occurred during chat processing."}), 500

