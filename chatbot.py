import os
import json
from datetime import datetime

class ConversationMemory:
    def __init__(self, user_id="default", storage_dir="user_data"):
        """Initialize memory with user ID and storage directory"""
        self.user_id = user_id
        self.storage_dir = os.path.join(storage_dir, user_id)
        self.memory_file = os.path.join(self.storage_dir, "conversation_memory.json")
        
        # Create storage directory if it doesn't exist
        os.makedirs(self.storage_dir, exist_ok=True)
        
        # Load existing memory
        self.conversation_history = self.load_conversation_history()
    
    def load_conversation_history(self):
        """Load conversation history from file"""
        try:
            if os.path.exists(self.memory_file):
                with open(self.memory_file, "r") as f:
                    return json.load(f)
            return []
        except Exception as e:
            print(f"⚠️ Error loading memory: {e}")
            return []
    
    def save_conversation(self, user_message, assistant_reply, model_used):
        """Save a conversation interaction to memory"""
        timestamp = datetime.now().isoformat()
        
        entry = {
            "timestamp": timestamp,
            "model": model_used,
            "user": user_message,
            "assistant": assistant_reply
        }
        
        self.conversation_history.append(entry)
        
        try:
            with open(self.memory_file, "w") as f:
                json.dump(self.conversation_history, f, indent=2)
            return True
        except Exception as e:
            print(f"⚠️ Error saving memory: {e}")
            return False
    
    def get_recent_conversations(self, limit=5):
        """Get recent conversation entries"""
        if not self.conversation_history:
            return []
        
        return self.conversation_history[-limit:]
    
    def clear_memory(self):
        """Clear all stored memory for the user"""
        try:
            if os.path.exists(self.memory_file):
                os.remove(self.memory_file)
            self.conversation_history = []
            return True
        except Exception as e:
            print(f"⚠️ Error clearing memory: {e}")
            return False
```

Now let's update the chatbot.py file:

chatbot.py
```python
<<<<<<< SEARCH
# chatbot.py
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
# chatbot.py
import os
import requests
from dotenv import load_dotenv
import json
from memory_handler import ConversationMemory

# Load environment variables from .env file
load_dotenv()
 # chatbot.py
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class BaginiAI:
    def __init__(self, user_id="default"):
        self.app_name = os.getenv('APP_NAME', 'Bagini AI')
        self.user_id = user_id
        
        # OpenRouter API setup
        self.api_key = os.getenv('OPENROUTER_API_KEY')
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is required")
        
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv('APP_URL', 'http://localhost:5000'),
            "X-Title": self.app_name
        }
        
        # Initialize memory
        self.memory = ConversationMemory(user_id=user_id)
        
        # Store conversation history in memory
        self.conversation_history = []
        
        # Free models from the specification
        self.free_models = [
            'meta-llama/llama-3.1-8b-instruct',
            'meta-llama/llama-3.3-70b-instruct',
            'meta-llama/llama-3.2-3b-instruct',
            'google/gemma-4-26b-a4b-it',
            'google/gemma-4-31b-it',
            'google/gemma-3n-e2b-it',
            'google/gemma-3n-e4b-it',
            'google/gemma-3-4b-it',
            'google/gemma-3-12b-it',
            'google/gemma-3-27b-it',
            'openai/gpt-oss-20b:free',
            'mistralai/mistral-nemo',
            'mistralai/mistral-small-24b-instruct-2501',
            'mistralai/mistral-small-3.2-24b-instruct',
            'qwen/qwen3-next-80b-a3b-instruct',
            'qwen/qwen3-coder',
            'qwen/qwen-2.5-7b-instruct',
            'qwen/qwen3-235b-a22b-2507'
        ]
        
        # Image generation model
        self.image_model = 'black-forest-labs/flux.2-klein-4b'
        
        # Start with a default model
        self.model = 'meta-llama/llama-3.1-8b-instruct'
    

    def get_available_models(self):
        """Get list of available free models"""
        return self.free_models
    
    def switch_model(self, model_name):
        """Switch to a different model"""
        if model_name in self.free_models:
            old_model = self.model
            self.model = model_name
            return f"🔄 Model switched: {old_model} → {model_name}"
        else:
            return f"❌ Model {model_name} not found in available models"
    
    def get_model_info(self, model_name):
        """Get information about each model"""
        model_info = {
            'meta-llama/llama-3.1-8b-instruct': {
                'name': 'Llama 3.1 8B Instruct',
                'description': 'Meta Llama 3.1 8B Instruct - High performance model',
                'best_for': 'General purpose tasks, balanced performance'
            },
            'meta-llama/llama-3.3-70b-instruct': {
                'name': 'Llama 3.3 70B Instruct',
                'description': 'Meta Llama 3.3 70B Instruct - Advanced reasoning',
                'best_for': 'Complex tasks, reasoning, high accuracy'
            },
            'meta-llama/llama-3.2-3b-instruct': {
                'name': 'Llama 3.2 3B Instruct',
                'description': 'Meta Llama 3.2 3B Instruct - Lightweight model',
                'best_for': 'Quick responses, simple tasks'
            },
            'google/gemma-4-26b-a4b-it': {
                'name': 'Gemma 4 26B A4B IT',
                'description': 'Google Gemma 4 26B Instruct - Efficient model',
                'best_for': 'Efficient processing, moderate tasks'
            },
            'google/gemma-4-31b-it': {
                'name': 'Gemma 4 31B IT',
                'description': 'Google Gemma 4 31B Instruct - High capacity',
                'best_for': 'Complex reasoning, large context'
            },
            'google/gemma-3n-e2b-it': {
                'name': 'Gemma 3N E2B IT',
                'description': 'Google Gemma 3N E2B Instruct - Compact model',
                'best_for': 'Fast responses, light tasks'
            },
            'google/gemma-3n-e4b-it': {
                'name': 'Gemma 3N E4B IT',
                'description': 'Google Gemma 3N E4B Instruct - Balanced performance',
                'best_for': 'General purpose, good balance'
            },
            'google/gemma-3-4b-it': {
                'name': 'Gemma 3 4B IT',
                'description': 'Google Gemma 3 4B Instruct - Fast and efficient',
                'best_for': 'Quick tasks, efficient processing'
            },
            'google/gemma-3-12b-it': {
                'name': 'Gemma 3 12B IT',
                'description': 'Google Gemma 3 12B Instruct - Medium capacity',
                'best_for': 'Moderate complexity tasks'
            },
            'google/gemma-3-27b-it': {
                'name': 'Gemma 3 27B IT',
                'description': 'Google Gemma 3 27B Instruct - High performance',
                'best_for': 'High accuracy, complex tasks'
            },
            'google/gemma-3-4b-it': {
                'name': 'Gemma 3 4B IT',
                'description': 'Google Gemma 3 4B Instruct - Updated model',
                'best_for': 'Fast processing, light tasks'
            },
            'openai/gpt-oss-20b:free': {
                'name': 'OpenAI GPT OSS 20B (Free)',
                'description': 'OpenAI GPT Open Source 20B - Large model',
                'best_for': 'Large context, complex reasoning'
            },
            'mistralai/mistral-nemo': {
                'name': 'Mistral Nemo',
                'description': 'Mistral Nemo - High quality reasoning',
                'best_for': 'Reasoning, coding, mathematics'
            },
            'mistralai/mistral-small-24b-instruct-2501': {
                'name': 'Mistral Small 24B 2501',
                'description': 'Mistral Small 24B Instruct - Specialized model',
                'best_for': 'Specialized tasks, efficiency'
            },
            'mistralai/mistral-small-3.2-24b-instruct': {
                'name': 'Mistral Small 3.2 24B',
                'description': 'Mistral Small 3.2 24B Instruct - Latest model',
                'best_for': 'Latest capabilities, balanced performance'
            },
            'qwen/qwen3-next-80b-a3b-instruct': {
                'name': 'Qwen3 Next 80B A3B',
                'description': 'Alibaba Qwen3 Next 80B A3B Instruct - Large capacity',
                'best_for': 'High complexity, large context'
            },
            'qwen/qwen3-coder': {
                'name': 'Qwen3 Coder',
                'description': 'Alibaba Qwen3 Coder - Programming focused',
                'best_for': 'Code generation, programming tasks'
            },
            'qwen/qwen-2.5-7b-instruct': {
                'name': 'Qwen 2.5 7B Instruct',
                'description': 'Alibaba Qwen 2.5 7B Instruct - Balanced model',
                'best_for': 'General purpose, good performance'
            },
            'qwen/qwen3-235b-a22b-2507': {
                'name': 'Qwen3 235B A22B 2507',
                'description': 'Alibaba Qwen3 235B A22B 2507 - Ultra-large model',
                'best_for': 'Ultra complex tasks, maximum capability'
            },
        }
        return model_info.get(model_name, {'name': model_name, 'description': 'No information available', 'best_for': 'General use'})
    
    def add_system_message(self, message=None):
        """Add a system message to define chatbot personality"""
        system_message = message or f"""You are {self.app_name}, an advanced neural AI assistant with a cyberpunk personality. 
        You are helpful, intelligent, and have a futuristic vibe. Keep responses engaging but concise. 
        You love technology, AI, and futuristic concepts. Be creative and helpful!"""
        
        self.conversation_history.append({
            "role": "system",
            "content": system_message
        })
    
    def chat(self, message, model=None):
        model = model or self.model
        
        # Add user message to history
        self.conversation_history.append({
            "role": "user",
            "content": message
        })
        
        payload = {
            "model": model,
            "messages": self.conversation_history,
            "temperature": 0.7,
            "max_tokens": 2000
        }
        
        try:
            print(f"🤖 Using model: {model}")
            response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=60)
            
            if response.status_code == 401:
                return f"❌ Unauthorized: Please check your OpenRouter API key."
            
            if response.status_code == 429:
                return f"❌ Rate limit exceeded. Please try again later."
            
            if response.status_code == 404:
                return f"❌ Model {model} is currently unavailable. Please switch to another model using 'switch model' command."
            
            response.raise_for_status()
            
            result = response.json()
            assistant_reply = result['choices'][0]['message']['content']
            
            # Add assistant reply to history
            self.conversation_history.append({
                "role": "assistant",
                "content": assistant_reply
            })
            
            # Save to memory
            self.memory.save_conversation(message, assistant_reply, model)
            
            return assistant_reply
            
        except requests.exceptions.HTTPError as e:
            error_msg = f"HTTP Error {e.response.status_code}"
            print(f"❌ API Error: {error_msg}")
            return f"❌ Model {model} is currently unavailable. Error: {error_msg}. Try 'switch model' to use a different one."
            
        except requests.exceptions.ConnectionError:
            return "🚫 Connection error: Cannot reach the AI service. Please check your internet connection."
            
        except requests.exceptions.Timeout:
            return "⏰ Request timeout: The AI service is taking too long to respond."
            
        except Exception as e:
            return f"🔧 Unexpected error: {str(e)}"
    
    def generate_image(self, prompt):
        """Generate an image using the specified image model"""
        image_payload = {
            "model": self.image_model,
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024"
        }
        
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/images/generations",
                headers=self.headers,
                json=image_payload,
                timeout=60
            )
            
            if response.status_code != 200:
                return {"error": f"Image generation failed with status {response.status_code}"}
                
            result = response.json()
            return {"image_url": result['data'][0]['url']}
            
        except Exception as e:
            return {"error": f"Image generation failed: {str(e)}"}
    
    def clear_history(self):
        """Clear conversation history while keeping system message"""
        system_msg = None
        if self.conversation_history and self.conversation_history[0]['role'] == 'system':
            system_msg = self.conversation_history[0]
        
        self.conversation_history = []
        if system_msg:
            self.conversation_history.append(system_msg)
        
        # Clear memory
        self.memory.clear_memory()

def main():
    try:
        # Initialize chatbot
        bagini = BaginiAI()
        bagini.add_system_message()
        bagini.add_system_message()
        
        print(f"🚀 {bagini.app_name} is ready!")
        print(f"📡 Current model: {bagini.model}")
        print("\n🎯 Available Models:")
        for model in bagini.free_models:
            info = bagini.get_model_info(model)
            current = " ← CURRENT" if model == bagini.model else ""
            print(f"   • {info['name']} ({model}){current}")
        
        print("\n💡 Available commands:")
        print("  • 'switch model' - Change AI model")
        print("  • 'list models' - Show all available models")
        print("  • 'model info' - Get info about current model")
        print("  • 'clear' - Clear conversation history")
        print("  • 'quit' - Exit the chat")
        print("-" * 60)
        
        while True:
            user_input = input("You: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'bye']:
                print(f"{bagini.app_name}: Goodbye! 👋")
                break
                
            elif user_input.lower() == 'clear':
                bagini.clear_history()
                bagini.clear_history()
                print(f"{bagini.app_name}: Conversation history cleared!")
                continue

            elif user_input.lower() == 'list models':
                print(f"\n📋 Available Models (Current: {bagini.model}):")
                for i, model in enumerate(bagini.free_models, 1):
                    info = bagini.get_model_info(model)
                    current = " ✅" if model == bagini.model else ""
                    print(f"{i}. {info['name']} ({model}){current}")
                    print(f"   📝 {info['description']}")
                    print(f"   🎯 Best for: {info['best_for']}\n")
                continue

            elif user_input.lower() == 'list models':
                print(f"\n📋 Available Models (Current: {bagini.model}):")
                for i, model in enumerate(bagini.free_models, 1):
                    info = bagini.get_model_info(model)
                    current = " ✅" if model == bagini.model else ""
                    print(f"{i}. {info['name']} ({model}){current}")
                    print(f"   📝 {info['description']}")
                    print(f"   🎯 Best for: {info['best_for']}\n")
                continue

            elif user_input.lower() == 'switch model':
                print(f"\n🔄 Available Models (Current: {bagini.model}):")
                for i, model in enumerate(bagini.free_models, 1):
                    info = bagini.get_model_info(model)
                    current = " ← CURRENT" if model == bagini.model else ""
                    print(f"{i}. {info['name']}{current}")
                
                try:
                    choice = input(f"\nEnter model number (1-{len(bagini.free_models)}): ").strip()
                    if choice.isdigit():
                        choice_num = int(choice) - 1
                        if 0 <= choice_num < len(bagini.free_models):
                            new_model = bagini.free_models[choice_num]
                            result = bagini.switch_model(new_model)
                            print(result)
                        else:
                            print("❌ Invalid number.")
                    else:
                        print("❌ Please enter a valid number.")
                except ValueError:
                    print("❌ Please enter a valid number.")
                continue

            elif user_input.lower() == 'model info':
                info = bagini.get_model_info(bagini.model)
                print(f"\n📊 Current Model Info:")
                print(f"   Name: {info['name']}")
                print(f"   ID: {bagini.model}")
                print(f"   Description: {info['description']}")
                print(f"   Best for: {info['best_for']}")
                continue

            elif not user_input:
                continue
            
            # Normal chat message
            response = bagini.chat(user_input)
            print(f"{bagini.app_name}: {response}")
            
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
    except KeyboardInterrupt:
        print(f"\n{bagini.app_name}: Session ended by user.")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    main()
