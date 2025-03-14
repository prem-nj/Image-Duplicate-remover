import os
import logging
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from image_processor import process_images
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static')
CORS(app)

# Configure upload folder path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(CURRENT_DIR, 'uploads')
app.config.update(
    SECRET_KEY='your-secret-key',
    UPLOAD_FOLDER=UPLOAD_FOLDER,
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB max file size
    TEMPLATES_AUTO_RELOAD=True
)

# Ensure upload directory exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, mode=0o755)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_files():
    try:
        logger.debug(f"Files in request: {request.files}")
        logger.debug(f"Content type: {request.content_type}")
        
        files = request.files.getlist('files[]')
        if not files:
            return jsonify({'error': 'No files uploaded'}), 400

        uploaded_files = []
        for file in files:
            if file and allowed_file(file.filename):
                try:
                    filename = secure_filename(file.filename)
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    logger.debug(f"Saving file: {filename}")
                    file.save(filepath)
                    uploaded_files.append(filepath)
                except Exception as e:
                    logger.error(f"Error saving file {file.filename}: {e}")
                    continue

        if not uploaded_files:
            return jsonify({'error': 'No valid image files uploaded'}), 400

        logger.debug(f"Processing {len(uploaded_files)} files")
        result = process_images(uploaded_files)
        logger.debug(f"Process result: {result}")

        # Clean up uploaded files
        for filepath in uploaded_files:
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
            except Exception as e:
                logger.error(f"Error removing file {filepath}: {e}")

        return jsonify(result)

    except Exception as e:
        logger.exception("Upload error:")
        return jsonify({'error': str(e)}), 500

@app.route('/delete-duplicates', methods=['POST'])
def delete_duplicates():
    try:
        data = request.get_json()
        if not data or 'duplicates' not in data:
            return jsonify({'error': 'Invalid request data'}), 400

        deleted_files = []
        for duplicate in data['duplicates']:
            try:
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(duplicate))
                if os.path.exists(filepath):
                    os.remove(filepath)
                    deleted_files.append(duplicate)
                    logger.debug(f"Deleted duplicate file: {duplicate}")
            except Exception as e:
                logger.error(f"Error deleting file {duplicate}: {e}")

        return jsonify({
            'success': True,
            'deleted_files': deleted_files,
            'message': f'Successfully deleted {len(deleted_files)} duplicates'
        })

    except Exception as e:
        logger.exception("Delete error:")
        return jsonify({'error': str(e)}), 500

# Add error handler for large files
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large'}), 413

if __name__ == '__main__':
    app.run(debug=True)