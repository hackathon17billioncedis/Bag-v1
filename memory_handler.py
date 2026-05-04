# memory_handler.py
import json
import os
from datetime import datetime

class ConversationMemory:
    def __init__(self, user_id="default"):
        self.user_id = user_id
        self.memory_file = f"memory_{user_id}.json"
        self.conversations = self.load_memory()
    
    def load_memory(self):
        if os.path.exists(self.memory_file):
            with open(self.memory_file, 'r') as f:
                return json.load(f)
        return []
    
    def save_conversation(self, user_message, ai_response, model_used=None):
        conversation = {
            'timestamp': datetime.now().isoformat(),
            'user': user_message,
            'assistant': ai_response,
            'model': model_used
        }
        self.conversations.append(conversation)
        
        # Keep only last 100 conversations
        if len(self.conversations) > 100:
            self.conversations = self.conversations[-100:]
        
        with open(self.memory_file, 'w') as f:
            json.dump(self.conversations, f, indent=2)
    
    def get_context(self, max_messages=10):
        return self.conversations[-max_messages:] if self.conversations else []
    
    def clear_memory(self):
        self.conversations = []
        if os.path.exists(self.memory_file):
            os.remove(self.memory_file)