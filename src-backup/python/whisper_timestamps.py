import whisper
import torch
import numpy as np
from typing import List, Dict
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_model():
    """Load the Whisper model."""
    try:
        logger.info("Loading Whisper model...")
        model = whisper.load_model("base")
        return model
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
        raise

def get_word_timestamps(audio_path: str) -> List[Dict]:
    """
    Get precise word-level timestamps from audio using Whisper.
    Returns a list of dicts with word, start_time, and end_time.
    """
    try:
        model = load_model()
        logger.info(f"Processing audio file: {audio_path}")
        
        # Transcribe with word timestamps
        result = model.transcribe(
            audio_path,
            word_timestamps=True,
            language="en",
            fp16=False  # Force FP32 on CPU
        )
        
        # Extract word-level segments
        words = []
        if not isinstance(result, dict) or 'segments' not in result:
            logger.error(f"Unexpected transcription result format: {result}")
            raise ValueError("Invalid transcription result format")
            
        for segment in result["segments"]:
            if not isinstance(segment, dict) or 'words' not in segment:
                logger.warning(f"Skipping invalid segment: {segment}")
                continue
                
            for word_data in segment["words"]:
                if not isinstance(word_data, dict):
                    logger.warning(f"Skipping invalid word data: {word_data}")
                    continue
                    
                # Extract required fields with fallbacks
                word = word_data.get("word", "").strip()
                start = word_data.get("start", 0)
                end = word_data.get("end", 0)
                
                if not word or end <= start:
                    logger.warning(f"Skipping invalid word entry: {word_data}")
                    continue
                
                words.append({
                    "text": word,
                    "start": start,
                    "end": end
                })
        
        if not words:
            logger.error("No valid words found in transcription")
            raise ValueError("No valid words found in transcription")
        
        logger.info(f"Generated timestamps for {len(words)} words")
        return words
    
    except Exception as e:
        logger.error(f"Failed to generate word timestamps: {str(e)}")
        raise

def group_words_into_phrases(words: List[Dict], max_words: int = 3) -> List[Dict]:
    """
    Group words into phrases of up to max_words length.
    Returns a list of dicts with phrase text and timestamps.
    """
    try:
        if not words:
            raise ValueError("Empty words list")
            
        phrases = []
        current_phrase = []
        current_length = 0
        max_phrase_length = 50  # Maximum characters in a phrase
        
        for word in words:
            word_length = len(word["text"])
            
            # Start new phrase if current one would be too long
            if current_length + word_length > max_phrase_length or len(current_phrase) >= max_words:
                if current_phrase:
                    phrase_text = " ".join(w["text"] for w in current_phrase)
                    phrases.append({
                        "text": phrase_text,
                        "start": current_phrase[0]["start"],
                        "end": current_phrase[-1]["end"]
                    })
                current_phrase = []
                current_length = 0
            
            current_phrase.append(word)
            current_length += word_length + 1  # +1 for space
        
        # Handle remaining words
        if current_phrase:
            phrase_text = " ".join(w["text"] for w in current_phrase)
            phrases.append({
                "text": phrase_text,
                "start": current_phrase[0]["start"],
                "end": current_phrase[-1]["end"]
            })
        
        logger.info(f"Grouped {len(words)} words into {len(phrases)} phrases")
        return phrases
        
    except Exception as e:
        logger.error(f"Failed to group words into phrases: {str(e)}")
        raise

if __name__ == "__main__":
    # Test the functionality
    import sys
    if len(sys.argv) != 2:
        print("Usage: python whisper_timestamps.py <audio_file>")
        sys.exit(1)
    
    try:
        audio_file = sys.argv[1]
        words = get_word_timestamps(audio_file)
        phrases = group_words_into_phrases(words)
        
        print("\nGenerated phrases:")
        for phrase in phrases:
            print(f"{phrase['start']:.2f} -> {phrase['end']:.2f}: {phrase['text']}")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1) 