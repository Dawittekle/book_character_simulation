import hashlib
import chromadb
from chromadb.utils import embedding_functions
import json
import logging
from dotenv import load_dotenv
import os

logger = logging.getLogger(__name__)
load_dotenv()

class CharacterDB:
    
    def __init__(self):
        self.client = chromadb.Client()
        
        self.embedding_function = embedding_functions.OpenAIEmbeddingFunction(
            api_key=os.getenv('OPENAI_API_KEY'),
            model_name="text-embedding-3-small"
        )
        
        self.collection = self.client.get_or_create_collection(
            name="characters",
            embedding_function=self.embedding_function
        )

    def _generate_character_id(self, text_id: str, character_name: str) -> str:
        """Generate deterministic ID from text_id and character_name"""
        combined = f"{text_id}_{character_name}".encode('utf-8')
        return hashlib.md5(combined).hexdigest()

    def store_characters(self, text_id: str, characters) -> bool:
        """
        Store characters with stable IDs based on text_id and name
        Args:
            text_id: Source document identifier
            characters: List of character dictionaries
        Returns:
            bool: True if successful
        """
        try:
            documents = []
            ids = []
            metadatas = []
            
            for char in characters:
                char_id = self._generate_character_id(text_id, char['name'])
                doc = f"""
                Character: {char['name']}
                Personality: {char['personality']}
                Key Events: {', '.join(char['key_events'])}
                Relationships: {', '.join(char['relationships'])}
                Psi: {json.dumps(char['psi_parameters'])}
                """
                
                documents.append(doc)
                ids.append(char_id)
                metadatas.append({
                    "text_id": text_id,
                    "character_name": char["name"],
                    "raw_data": json.dumps(char)
                })
            
            self.collection.upsert(
                documents=documents,
                ids=ids,
                metadatas=metadatas
            )
            
            logger.info(f"Stored {len(characters)} characters for text_id {text_id}")
            return True
            
        except Exception as e:
            logger.error(f"Storage failed: {str(e)}")
            return False

    def get_characters(self, text_id: str):
        """
        Retrieve all characters for a given text_id
        Args:
            text_id: Source document identifier
        Returns:
            List of character dictionaries or None if not found
        """
        try:
            results = self.collection.get(
                where={"text_id": text_id},
                include=["metadatas"]
            )
            
            if not results["ids"]:
                return None
                
            return [json.loads(meta["raw_data"]) for meta in results["metadatas"]]
            
        except Exception as e:
            logger.error(f"Retrieval failed: {str(e)}")
            return None