# file_handler.py
import os
import tempfile
from flask import request, jsonify

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'txt', 'pdf', 'docx', 'png', 'jpg'}

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        # Save file temporarily
        temp_path = os.path.join(tempfile.gettempdir(), file.filename)
        file.save(temp_path)
        
        # Process file based on type
        if file.filename.endswith('.txt'):
            with open(temp_path, 'r', encoding='utf-8') as f:
                content = f.read()
            response = bagini.chat(f"Please analyze this document: {content}")
        # Add more file type handlers...
        
        # Clean up
        os.remove(temp_path)
        return jsonify({'response': response})
    
    return jsonify({'error': 'Invalid file type'}), 400