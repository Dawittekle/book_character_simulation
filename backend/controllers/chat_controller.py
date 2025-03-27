import json
import logging
import uuid
import datetime
import os
from typing import Dict, Any, Tuple, Optional, List

from langchain.chains import LLMChain
from langchain.chat_models import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate

from database.chroma_manager import CharacterDB
import chromadb

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class FactualMemoryDB:
    """ChromaDB-based storage for character factual memories"""
    
    def __init__(self):
        db_path = os.getenv('CHROMA_DB_PATH', './chroma_db')
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(
            name="factual_memories",
            metadata={"hnsw:space": "cosine"}
        )
    
    def save_memory(self, memory_id: str, character_id: str, text_id: str, 
                   fact: str, source_session_id: str):
        """Save a factual memory to ChromaDB."""
        metadata = {
            "character_id": character_id,
            "text_id": text_id,
            "source_session_id": source_session_id,
            "created_at": datetime.datetime.utcnow().isoformat()
        }
        
        self.collection.upsert(
            ids=[memory_id],
            documents=[fact],
            metadatas=[metadata]
        )
    
    def get_memories(self, character_id: str, text_id: str) -> List[Dict[str, Any]]:
        """Retrieve all factual memories for a character and text."""
        result = self.collection.get(
            where={
                "$and": [
                    {"character_id": {"$eq": character_id}},
                    {"text_id": {"$eq": text_id}}
                ]
            },
            include=["documents", "metadatas"]  
        )
        
        memories = []
        for i, memory_id in enumerate(result["ids"]):
            fact = result["documents"][i]
            metadata = result["metadatas"][i]
            
            memories.append({
                "id": memory_id,
                "fact": fact,
                "character_id": metadata["character_id"],
                "text_id": metadata["text_id"],
                "source_session_id": metadata["source_session_id"],
                "created_at": metadata["created_at"]
            })
            
        return memories

class ChatSessionDB:
    """ChromaDB-based session storage for chat sessions"""
    
    def __init__(self):
        db_path = os.getenv('CHROMA_DB_PATH', './chroma_db')
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(
            name="chat_sessions",
            metadata={"hnsw:space": "cosine"}
        )
    
    def save_session(self, session_id: str, character_id: str, text_id: str, 
                     psi_parameters: Dict, emotion_state: Dict, chat_history: str):
        """Save a chat session to ChromaDB with both psi_parameters and emotion_state."""
        if not isinstance(chat_history, str):
            chat_history = json.dumps(chat_history)
            
        metadata = {
            "character_id": character_id,
            "text_id": text_id,
            "last_updated": datetime.datetime.utcnow().isoformat()
        }
        
        document = json.dumps({
            "psi_parameters": psi_parameters,
            "emotion_state": emotion_state,
            "chat_history": chat_history
        })
        
        existing_sessions = self.collection.get(
            ids=[session_id],
            include=["metadatas"]
        )
        
        if existing_sessions["ids"]:
            self.collection.update(
                ids=[session_id],
                documents=[document],
                metadatas=[metadata]
            )
        else:
            self.collection.add(
                ids=[session_id],
                documents=[document],
                metadatas=[{
                    **metadata,
                    "created_at": datetime.datetime.utcnow().isoformat()
                }]
            )
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a chat session from ChromaDB."""
        result = self.collection.get(
            ids=[session_id],
            include=["documents", "metadatas"]
        )
        
        if not result["ids"]:
            return None
            
        document_data = json.loads(result["documents"][0])
        metadata = result["metadatas"][0]
        
        return {
            "id": session_id,
            "character_id": metadata["character_id"],
            "text_id": metadata["text_id"],
            "psi_parameters": document_data["psi_parameters"],
            "emotion_state": document_data["emotion_state"],
            "chat_history": document_data["chat_history"],
            "created_at": metadata.get("created_at"),
            "last_updated": metadata["last_updated"]
        }
    
    def get_sessions_by_character(self, character_id: str, text_id: str) -> list:
        """Get all sessions for a specific character."""
        result = self.collection.get(
            where={"character_id": character_id, "text_id": text_id},
            include=["documents", "metadatas", "ids"]
        )
        
        sessions = []
        for i, session_id in enumerate(result["ids"]):
            document_data = json.loads(result["documents"][i])
            metadata = result["metadatas"][i]
            
            sessions.append({
                "id": session_id,
                "character_id": metadata["character_id"],
                "text_id": metadata["text_id"],
                "psi_parameters": document_data["psi_parameters"],
                "emotion_state": document_data["emotion_state"],
                "chat_history": document_data["chat_history"],
                "created_at": metadata.get("created_at"),
                "last_updated": metadata["last_updated"]
            })
            
        return sessions

class ChatController:
    def __init__(self, llm: ChatOpenAI):
        self.llm = llm
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.chain = self._create_psi_update_chain()
        self.fact_extraction_chain = self._create_fact_extraction_chain()
        self.db = CharacterDB()
        self.session_db = ChatSessionDB()
        self.factual_memory_db = FactualMemoryDB()
    
    def _create_psi_update_chain(self):
        template = ("""
                You are an advanced AI role-playing as a character from a book. Your task is to **fully embody** the character and generate a response that remains **true to their personality, speech style, emotions, and worldview**.

                ### **Character Details:**  
                {character}

                ### **Conversation Context:**  
                - You must **never break character** and should respond exactly as they would.  
                - Maintain **emotional consistency** based on the character's psychological parameters and current emotion state.  
                - Use **past conversation history** to ensure continuity.  
                {chat_history}

                ### **Character's Factual Memories:**
                These are facts the character has learned from previous conversations:
                {factual_memories}

                ### **Character's Current Psychological & Emotional State:**  
                Psi Parameters: {psi_parameters}  
                Emotion State: {emotion_state}

                ### **User's Latest Message:**  
                "{latest_message}"

                ---

                ### **Response Instructions:**  
                1. **Stay in character** – Do not sound like an AI or a generic chatbot. Respond as the character would.  
                2. **Adapt emotions and update psychological state** – Modify both the psi parameters and the corresponding emotion state in a manner consistent with Dorner's Psi Theory.  
                3. **Do not provide any extra information** – Your response must **only** be a properly formatted JSON object.
                4. **Please don't update anything if the latest message is very neutral**
                5. **Use factual memories when relevant** - Incorporate previously learned facts when appropriate.

                ### **STRICT RESPONSE FORMAT (JSON-ONLY OUTPUT)**  
                {{
                    "reply": "Character's in-character response.",
                    "updated_psi": {{
                        "valence_level": float,  
                        "arousal_level": float,  
                        "selection_threshold": float,  
                        "resolution_level": float,  
                        "goal_directedness": float,  
                        "securing_rate": float  
                    }},
                    "updated_emotion_state": {{
                        "anger": float,
                        "sadness": float,
                        "pride": float,
                        "joy": float,
                        "bliss": float
                    }}
                }}
                """
        )

        prompt = ChatPromptTemplate.from_messages([
            HumanMessagePromptTemplate.from_template(template)
        ])
        return LLMChain(llm=self.llm, prompt=prompt)
    
    def _create_fact_extraction_chain(self):
        template = ("""
                You are an AI assistant that extracts factual information from conversations.
                
                ### Conversation History:
                {chat_history}
                
                ### Latest Exchange:
                User: {user_message}
                Character: {character_response}
                
                ### Instructions:
                1. Analyze the conversation and identify any NEW factual information that was shared or confirmed.
                2. Focus only on objective facts about the world, characters, events, or relationships.
                3. Ignore opinions, emotions, or subjective statements.
                4. Extract only facts that would be useful for the character to remember in future conversations.
                5. If no new factual information was shared, return an empty list.
                
                ### Output Format (JSON):
                {{
                    "facts": [
                        "Fact 1 in a clear, concise statement",
                        "Fact 2 in a clear, concise statement",
                        ...
                    ]
                }}
                """
        )
        
        prompt = ChatPromptTemplate.from_messages([
            HumanMessagePromptTemplate.from_template(template)
        ])
        return LLMChain(llm=self.llm, prompt=prompt)
    
    def _extract_and_store_facts(self, session_id: str, character_id: str, text_id: str, 
                                user_message: str, character_response: str, chat_history: str):
        """Extract factual information from the conversation and store it."""
        chain_inputs = {
            "chat_history": chat_history,
            "user_message": user_message,
            "character_response": character_response
        }
        
        try:
            # First get existing memories to check for duplicates
            existing_memories = self.factual_memory_db.get_memories(character_id, text_id)
            existing_facts = [memory["fact"].lower().strip() for memory in existing_memories]
            
            response = self.fact_extraction_chain.invoke(chain_inputs)
            result = json.loads(response["text"])
            facts = result.get("facts", [])
            
            for fact in facts:
                if fact and len(fact.strip()) > 0:
                    # Check if this fact (or a very similar one) already exists
                    if fact.lower().strip() not in existing_facts:
                        memory_id = str(uuid.uuid4())
                        self.factual_memory_db.save_memory(
                            memory_id=memory_id,
                            character_id=character_id,
                            text_id=text_id,
                            fact=fact,
                            source_session_id=session_id
                        )
                        logger.info(f"Stored new factual memory: {fact}")
                        # Add to existing facts to prevent duplicates in the same batch
                        existing_facts.append(fact.lower().strip())
                    else:
                        logger.info(f"Skipped duplicate fact: {fact}")
        except Exception as e:
            logger.error(f"Error extracting facts: {str(e)}")
    
    def _get_or_create_session(self, character_id: str, text_id: str, session_id: Optional[str] = None) -> Tuple[str, Dict[str, Any]]:
        """Get an existing session or create a new one."""
        # Check if session exists
        if session_id:
            # First check in-memory cache
            if session_id in self.active_sessions:
                return session_id, self.active_sessions[session_id]
            
            # Then check ChromaDB
            session = self.session_db.get_session(session_id)
            if session:
                memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
                chat_history = json.loads(session["chat_history"])
                for msg in chat_history:
                    if msg["type"] == "user":
                        memory.chat_memory.add_user_message(msg["content"])
                    elif msg["type"] == "ai":
                        memory.chat_memory.add_ai_message(msg["content"])
                
                session_data = {
                    "memory": memory,
                    "psi_parameters": session["psi_parameters"],
                    "emotion_state": session["emotion_state"],
                    "character_id": session["character_id"],
                    "text_id": session["text_id"]
                }
                self.active_sessions[session_id] = session_data
                return session_id, session_data
        
        # Create new session
        new_session_id = str(uuid.uuid4())
        character = self.db.get_character_by_id(character_id, text_id)
        if not character:
            raise ValueError("Character not found.")
            
        psi_parameters = character.get("psi_parameters")
        emotion_state = character.get("emotion_state")
        if psi_parameters is None or emotion_state is None:
            raise ValueError("Character psi parameters or emotion state missing.")
            
        memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
        session_data = {
            "memory": memory,
            "psi_parameters": psi_parameters,
            "emotion_state": emotion_state,
            "character_id": character_id,
            "text_id": text_id
        }
        self.active_sessions[new_session_id] = session_data
        
        self.session_db.save_session(
            session_id=new_session_id,
            character_id=character_id,
            text_id=text_id,
            psi_parameters=psi_parameters,
            emotion_state=emotion_state,
            chat_history=json.dumps([])  
        )
        
        return new_session_id, session_data
    
    def _save_session(self, session_id: str, session_data: Dict[str, Any]):
        """Save session to ChromaDB."""
        messages = session_data["memory"].chat_memory.messages
        chat_history = []
        
        for msg in messages:
            if hasattr(msg, 'type') and msg.type == 'human':
                chat_history.append({"type": "user", "content": msg.content})
            elif hasattr(msg, 'type') and msg.type == 'ai':
                chat_history.append({"type": "ai", "content": msg.content})
        
        self.session_db.save_session(
            session_id=session_id,
            character_id=session_data["character_id"],
            text_id=session_data["text_id"],
            psi_parameters=session_data["psi_parameters"],
            emotion_state=session_data["emotion_state"],
            chat_history=json.dumps(chat_history)
        )
    
    def _get_factual_memories(self, character_id: str, text_id: str) -> str:
        """Get all factual memories for a character as a formatted string."""
        memories = self.factual_memory_db.get_memories(character_id, text_id)
        if not memories:
            return "No previous factual memories."
        
        memory_text = "The character remembers these facts:\n"
        for i, memory in enumerate(memories):
            memory_text += f"{i+1}. {memory['fact']}\n"
        
        return memory_text
    
    def chat(self, character_id: str, user_message: str, text_id: str, session_id: str = None):
        # Get or create session
        session_id, session_data = self._get_or_create_session(character_id, text_id, session_id)
        
        memory = session_data["memory"]
        psi_parameters = session_data["psi_parameters"]
        emotion_state = session_data["emotion_state"]
        
        # Append the user's message to conversation memory
        memory.chat_memory.add_user_message(user_message)
        chat_history = memory.load_memory_variables({}).get("chat_history", "")
        
        # Get factual memories for this character and text
        factual_memories = self._get_factual_memories(character_id, text_id)
        print("fact", factual_memories)
        
        chain_inputs = {
            "character": self.db.get_character_by_id(character_id, text_id),
            "chat_history": chat_history,
            "factual_memories": factual_memories,
            "psi_parameters": json.dumps(psi_parameters),
            "emotion_state": json.dumps(emotion_state),
            "latest_message": user_message
        }
        
        response = self.chain.invoke(chain_inputs)
        raw_output = response["text"]
        result = json.loads(raw_output)
        reply = result.get("reply")
        updated_psi = result.get("updated_psi")
        updated_emotion_state = result.get("updated_emotion_state")
        
        if reply is None or updated_psi is None or updated_emotion_state is None:
            raise ValueError("Missing keys in response.")
        
        # Update session with new psi and emotion state, and add assistant reply to memory
        session_data["psi_parameters"] = updated_psi
        session_data["emotion_state"] = updated_emotion_state
        memory.chat_memory.add_ai_message(reply)
        
        # Extract and store factual information
        self._extract_and_store_facts(
            session_id=session_id,
            character_id=character_id,
            text_id=text_id,
            user_message=user_message,
            character_response=reply,
            chat_history=str(chat_history)
        )
        
        # Save session to database
        self._save_session(session_id, session_data)
        
        # Return updated psi parameters and emotion state as provided by the LLM
        return session_id, reply, updated_psi, updated_emotion_state
