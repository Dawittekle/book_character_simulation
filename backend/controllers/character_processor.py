import json
import logging
from typing import List
from pydantic import BaseModel, ValidationError, root_validator
from langchain.chains import LLMChain
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from datetime import datetime
from database.chroma_manager import CharacterDB

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

class PsiParameters(BaseModel):
    """Dorner's Psi Theory parameters with validation"""
    valence_level: float        
    arousal_level: float        
    selection_threshold: float
    resolution_level: float     
    goal_directedness: float   
    securing_rate: float        

    

class CharacterProfile(BaseModel):
    """Complete character representation"""
    name: str
    personality: str
    key_events: List[str]
    relationships: List[str]
    psi_parameters: PsiParameters

class EmotionState(BaseModel):
    """Dynamic emotional state derived from Psi parameters"""
    anger: float
    sadness: float
    pride: float
    joy: float
    bliss: float

class CharacterProcessor:
    """Handles character extraction and emotional modeling"""
    
    def __init__(self, llm):
        self.llm = llm
        self.prompt = self._create_prompt_template()
        self.chain = LLMChain(llm=self.llm, prompt=self.prompt)
        self.db = CharacterDB()

    def _create_prompt_template(self):
        """Structured prompt for reliable JSON generation"""
        template = """Extract characters from this text with their psychological profile:
        
        For each character, provide:
        - Name: Full name or primary identifier
        - Personality: 3-5 key traits (e.g., "idealistic, stubborn")
        - Key Events: Major story events (2-3 items)
        - Relationships: Important connections (2-3 items)
        - Psi Parameters (0.0-1.0):
          * valence_level: Attraction(+)/Aversion(-) tendency
          * arousal_level: Action readiness
          * selection_threshold: Resistance to goal changes
          * resolution_level: Perceptual accuracy
          * goal_directedness: Focus on objectives
          * securing_rate: Environment checking frequency

        Example Output:
        [
            {{
                "name": "Elizabeth Bennet",
                "personality": "independent, witty, strong-willed",
                "key_events": ["Refuses Mr. Collins' proposal", "Visits Pemberley"],
                "relationships": ["Fitzwilliam Darcy (complex relationship)", "Jane Bennet (sister)"],
                "psi_parameters": {{
                    "valence_level": 0.7,
                    "arousal_level": 0.6,
                    "selection_threshold": 0.8,
                    "resolution_level": 0.9,
                    "goal_directedness": 0.85,
                    "securing_rate": 0.4
                }}
            }}
        ]

        Text: {text}
        """
        return ChatPromptTemplate.from_messages([
            HumanMessagePromptTemplate.from_template(template)
        ])

    def extract_characters(self, text_id: str, text: str) -> List[CharacterProfile]:
        existing = self.db.get_characters(text_id)
        if existing:
            try:
                characters = [CharacterProfile(**c) for c in existing]
                logger.info(f"Returning cached characters for text_id {text_id}")
                return characters
            except ValidationError as e:
                logger.warning(f"Cache validation failed, reprocessing: {str(e)}")
        
        try:
            response = self.chain.invoke({"text": text})
            raw_output = response["text"]
            
            characters = self._parse_response(raw_output)
            
            characters_dict = [char.dict() for char in characters]
            self.db.store_characters(text_id, characters_dict)
            
            logger.info(f"Stored {len(characters)} new characters for text_id {text_id}")
            return characters
            
        except Exception as e:
            logger.error(f"Extraction failed: {str(e)}")
            self._log_error(raw_output if 'raw_output' in locals() else "No output", text)
            return []

    def _parse_response(self, raw_response: str) -> List[CharacterProfile]:
        """Validate and parse LLM output"""
        try:
            data = json.loads(raw_response)
            return [CharacterProfile(**c) for c in data]
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Validation failed: {str(e)}")
            raise ValueError("Invalid character data format") from e

    def _log_error(self, raw_response: str, original_text: str):
        """Log debugging information"""
        with open("processing_errors.log", "a") as f:
            f.write(f"Error occurred at {datetime.now()}\n")
            f.write(f"Input Text: {original_text[:500]}\n")
            f.write(f"Raw LLM Output: {raw_response}\n\n")

def calculate_emotions(psi: PsiParameters) -> EmotionState:
    """Calculate emotional state from current Psi parameters"""
    return EmotionState(
        anger=max(0, (1 - psi.valence_level) * psi.arousal_level),
        sadness=(1 - psi.valence_level) * (1 - psi.arousal_level),
        pride=(1 - psi.securing_rate) * psi.goal_directedness,
        joy=psi.valence_level * psi.arousal_level,
        bliss=psi.valence_level * (1 - psi.arousal_level)
    )
