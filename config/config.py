"""
Configuration settings for Chess Analysis Portal
"""

import os

class Config:
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'chess-analysis-secret-key-2025'
    
    # Database settings
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'database', 'chess_analysis.db')
    
    # Upload settings
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'pgn'}
    
    # Engine settings
    ENGINES = {
        'stockfish': {
            'path': '/opt/homebrew/bin/stockfish',  # macOS Homebrew
            'fallback_paths': [
                '/usr/local/bin/stockfish',
                '/usr/bin/stockfish',
                'stockfish'
            ]
        }
    }
    
    # Analysis settings
    DEFAULT_DEPTH = 15
    MAX_DEPTH = 25
    
    # Data source settings
    ANALYSIS_DATA_PATH = os.path.join(os.path.dirname(__file__), '..', '..')
    
class DevelopmentConfig(Config):
    DEBUG = True
    
class ProductionConfig(Config):
    DEBUG = False
    
# Default configuration
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
