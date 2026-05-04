# app.py
from flask import Flask, render_template, request, jsonify
import os
from dotenv import load_dotenv
import threading
import time

# Import the BaginiAI class
from chatbot import BaginiAI

# Import Voice Assistant
from voice_handler import voice_assistant

load_dotenv()

app = Flask(__name__)

# Initialize chatbot
try:
    bagini = BaginiAI()
    bagini.add_system_message()
    print("✅ Bagini AI initialized successfully!")
    print(f"📡 Using model: {bagini.model}")
    print("🎯 Available models:")
    for model in bagini.free_models:
        info = bagini.get_model_info(model)
        print(f"   • {info['name']} ({model})")
except Exception as e:
    print(f"❌ Error initializing Bagini AI: {e}")
    bagini = None

@app.route('/')
def home():
    return render_template('chat.html', 
                         app_name="Bagini AI", 
                         model=bagini.model if bagini else "Unknown",
                         available_models=bagini.free_models if bagini else [])

@app.route('/chat', methods=['POST'])
def chat():
    if not bagini:
        return jsonify({'response': 'Error: Bagini AI is not properly initialized. Check your API key.'}), 500
    
    try:
        user_message = request.json['message']
        response = bagini.chat(user_message)
        return jsonify({'response': response})
    except Exception as e:
        return jsonify({'response': f'Error: {str(e)}'}), 500

@app.route('/generate-image', methods=['POST'])
def generate_image():
    if not bagini:
        return jsonify({'error': 'Error: Bagini AI is not properly initialized. Check your API key.'}), 500
    
    try:
        prompt = request.json['prompt']
        result = bagini.generate_image(prompt)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Error: {str(e)}'}), 500

@app.route('/clear', methods=['POST'])
def clear_chat():
    if bagini:
        bagini.clear_history()
        # Re-add system message after clearing
        bagini.add_system_message()
    return jsonify({'status': 'success'})

@app.route('/models', methods=['GET'])
def get_models():
    if bagini:
        models_info = []
        for model in bagini.free_models:
            info = bagini.get_model_info(model)
            models_info.append({
                'id': model,
                'name': info['name'],
                'description': info['description'],
                'best_for': info['best_for'],
                'current': model == bagini.model
            })
        return jsonify({'models': models_info, 'current': bagini.model})
    return jsonify({'models': [], 'current': 'Unknown'})

@app.route('/switch-model', methods=['POST'])
def switch_model():
    if bagini:
        model_name = request.json.get('model')
        if model_name in bagini.free_models:
            result = bagini.switch_model(model_name)
            return jsonify({'status': 'success', 'message': result, 'current_model': model_name})
        else:
            return jsonify({'status': 'error', 'message': 'Model not available'}), 400
    return jsonify({'status': 'error', 'message': 'Bagini AI not initialized'}), 500

# Voice Routes
@app.route('/voice/listen', methods=['POST'])
def voice_listen():
    """Listen for voice input and return text"""
    try:
        text = voice_assistant.listen(timeout=10)
        if text:
            return jsonify({'success': True, 'text': text})
        else:
            return jsonify({'success': False, 'error': 'No speech detected'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/voice/speak', methods=['POST'])
def voice_speak():
    """Convert text to speech"""
    try:
        text = request.json.get('text', '')
        if text:
            voice_assistant.speak(text)
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'No text provided'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/voice/toggle-continuous', methods=['POST'])
def voice_toggle_continuous():
    """Toggle continuous listening mode"""
    try:
        if not hasattr(app, 'listen_thread') or not app.listen_thread.is_alive():
            # Start continuous listening
            stop_event = threading.Event()
            app.listen_stop_event = stop_event
            
            def voice_callback(text):
                # This will be called when voice is detected
                print(f"🎤 Voice command received: {text}")
                # In a real implementation, you might use WebSockets to send this to the frontend
            
            app.listen_thread = threading.Thread(
                target=voice_assistant.continuous_listen,
                args=(voice_callback, stop_event)
            )
            app.listen_thread.daemon = True
            app.listen_thread.start()
            return jsonify({'success': True, 'listening': True, 'message': 'Continuous listening enabled'})
        else:
            # Stop continuous listening
            app.listen_stop_event.set()
            voice_assistant.stop_listening()
            return jsonify({'success': True, 'listening': False, 'message': 'Continuous listening disabled'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/voice/status', methods=['GET'])
def voice_status():
    """Get voice system status"""
    return jsonify({
        'success': True,
        'listening': hasattr(app, 'listen_thread') and app.listen_thread.is_alive(),
        'speaking': voice_assistant.is_speaking
    })

@app.route('/status')
def status():
    return jsonify({
        'status': 'running' if bagini else 'error',
        'app_name': bagini.app_name if bagini else 'Unknown',
        'model': bagini.model if bagini else 'Unknown',
        'available_models': bagini.free_models if bagini else []
    })

# Adding a WSGI callable for Vercel deployment
try:
    # This is needed for Vercel deployments
    app.callable = app
except:
    pass

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    print(f"🌐 Starting Bagini AI server on http://localhost:5000")
    print(f"🤖 Using model: {bagini.model if bagini else 'Unknown'}")
    print(f"🎤 Voice features: ENABLED")
    app.run(debug=debug_mode, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))