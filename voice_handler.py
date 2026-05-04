# voice_handler.py
import speech_recognition as sr
import pyttsx3
import threading
import time

class VoiceAssistant:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        self.tts_engine = pyttsx3.init()
        self.is_listening = False
        self.is_speaking = False
        
        # Configure voice settings
        self.setup_voice()
        
        # Adjust for ambient noise
        print("🔊 Calibrating microphone for ambient noise...")
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=2)
        print("✅ Microphone calibrated!")
    
    def setup_voice(self):
        """Configure text-to-speech settings"""
        voices = self.tts_engine.getProperty('voices')
        
        # Try to use a female voice if available
        for voice in voices:
            if 'female' in voice.name.lower() or 'zira' in voice.name.lower():
                self.tts_engine.setProperty('voice', voice.id)
                break
        
        # Set speech rate and volume
        self.tts_engine.setProperty('rate', 180)  # Speech speed
        self.tts_engine.setProperty('volume', 0.8)  # Volume level
    
    def listen(self, timeout=5):
        """Listen for voice input and convert to text"""
        try:
            with self.microphone as source:
                print("🎤 Listening... (Speak now)")
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=10)
            
            print("🔄 Processing speech...")
            text = self.recognizer.recognize_google(audio)
            print(f"📝 You said: {text}")
            return text
            
        except sr.WaitTimeoutError:
            print("⏰ Listening timeout")
            return None
        except sr.UnknownValueError:
            print("❌ Could not understand audio")
            return None
        except sr.RequestError as e:
            print(f"🌐 Speech recognition error: {e}")
            return None
        except Exception as e:
            print(f"⚠️ Unexpected error: {e}")
            return None
    
    def speak(self, text):
        """Convert text to speech (non-blocking)"""
        if not text or self.is_speaking:
            return
            
        self.is_speaking = True
        
        def _speak():
            try:
                print(f"🗣️ Speaking: {text[:50]}..." if len(text) > 50 else f"🗣️ Speaking: {text}")
                self.tts_engine.say(text)
                self.tts_engine.runAndWait()
            except Exception as e:
                print(f"❌ TTS Error: {e}")
            finally:
                self.is_speaking = False
        
        # Run in separate thread to avoid blocking
        thread = threading.Thread(target=_speak)
        thread.daemon = True
        thread.start()
    
    def continuous_listen(self, callback, stop_event):
        """Continuously listen for voice commands"""
        self.is_listening = True
        print("🎤 Voice activation enabled - Say 'Bagini' to activate")
        
        while self.is_listening and not stop_event.is_set():
            try:
                with self.microphone as source:
                    # Listen for wake word
                    audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=3)
                    text = self.recognizer.recognize_google(audio).lower()
                    
                    if 'bagini' in text or 'begin' in text or 'hey' in text:
                        print("👂 Wake word detected! Listening for command...")
                        self.speak("Yes? How can I help you?")
                        
                        # Listen for actual command
                        command = self.listen(timeout=8)
                        if command:
                            callback(command)
                        
            except (sr.WaitTimeoutError, sr.UnknownValueError):
                # No speech detected, continue listening
                continue
            except Exception as e:
                print(f"❌ Continuous listen error: {e}")
                time.sleep(0.1)
    
    def stop_listening(self):
        """Stop continuous listening"""
        self.is_listening = False

# Global instance
voice_assistant = VoiceAssistant()