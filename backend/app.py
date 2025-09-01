#!/usr/bin/env python3
"""
Chess Analysis Portal - Main Flask Application
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import json
import sqlite3
from datetime import datetime
import chess.pgn
import chess.engine

app = Flask(__name__, template_folder='../templates', static_folder='../static')
app.config['UPLOAD_FOLDER'] = '../uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Database setup
DATABASE = '../database/chess_analysis.db'

def init_db():
    """Initialize the database"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Games table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            tournament TEXT,
            opponent TEXT,
            color TEXT,
            result TEXT,
            eco TEXT,
            time_control TEXT,
            pgn_path TEXT,
            analysis_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Analysis table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER,
            move_number INTEGER,
            move TEXT,
            eval_before INTEGER,
            eval_after INTEGER,
            centipawn_loss INTEGER,
            FOREIGN KEY (game_id) REFERENCES games (id)
        )
    ''')
    
    # Weekly progress table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS weekly_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_start DATE,
            games_played INTEGER,
            win_rate REAL,
            avg_cp_loss REAL,
            blunder_rate REAL,
            focus_area TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template('dashboard.html')

@app.route('/api/metrics')
def get_metrics():
    """API endpoint for dashboard metrics"""
    # Load latest analysis data
    analysis_files = []
    for root, dirs, files in os.walk('../'):
        if 'analysis-' in root and 'analysis_data.json' in files:
            analysis_files.append(os.path.join(root, 'analysis_data.json'))
    
    if not analysis_files:
        return jsonify({'error': 'No analysis data found'})
    
    # Get most recent analysis
    latest_file = max(analysis_files, key=os.path.getctime)
    
    with open(latest_file, 'r') as f:
        data = json.load(f)
    
    return jsonify(data)

@app.route('/upload')
def upload_page():
    """PGN upload page"""
    return render_template('upload.html')

@app.route('/api/upload', methods=['POST'])
def upload_pgn():
    """Handle PGN file upload and analysis"""
    if 'pgn_file' not in request.files:
        return jsonify({'error': 'No file uploaded'})
    
    file = request.files['pgn_file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'})
    
    if file and file.filename.endswith('.pgn'):
        # Save uploaded file
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Analyze with Stockfish
        engine_choice = request.form.get('engine', 'stockfish')
        analysis_result = analyze_pgn_file(filepath, engine_choice)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'analysis': analysis_result
        })
    
    return jsonify({'error': 'Invalid file format'})

def analyze_pgn_file(pgn_path, engine='stockfish'):
    """Analyze PGN file with chosen engine"""
    try:
        with open(pgn_path, 'r') as f:
            game = chess.pgn.read_game(f)
        
        if not game:
            return None
        
        engine_path = '/opt/homebrew/bin/stockfish'  # Default Stockfish path
        
        with chess.engine.SimpleEngine.popen_uci(engine_path) as engine:
            board = game.board()
            analysis_data = []
            
            for move_num, node in enumerate(game.mainline(), 1):
                info_before = engine.analyse(board, chess.engine.Limit(depth=15))
                eval_before = info_before["score"].relative.score(mate_score=10000)
                
                move = node.move
                board.push(move)
                
                info_after = engine.analyse(board, chess.engine.Limit(depth=15))
                eval_after = info_after["score"].relative.score(mate_score=10000)
                
                centipawn_loss = max(0, eval_before - (-eval_after)) if eval_before and eval_after else 0
                
                analysis_data.append({
                    "move_number": move_num,
                    "move": str(move),
                    "eval_before": eval_before or 0,
                    "eval_after": -eval_after if eval_after else 0,
                    "centipawn_loss": centipawn_loss
                })
        
        # Save analysis
        analysis_path = pgn_path.replace('.pgn', '_analysis.json')
        with open(analysis_path, 'w') as f:
            json.dump(analysis_data, f, indent=2)
        
        return analysis_data
        
    except Exception as e:
        return {'error': str(e)}

@app.route('/games')
def games_browser():
    """Games browser page"""
    return render_template('games.html')

@app.route('/progress')
def progress_tracking():
    """Weekly progress tracking page"""
    return render_template('progress.html')

@app.route('/api/games')
def get_games():
    """API endpoint for games list"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, date, tournament, opponent, color, result, eco, time_control
        FROM games ORDER BY date DESC
    ''')
    
    games = []
    for row in cursor.fetchall():
        games.append({
            'id': row[0],
            'date': row[1],
            'tournament': row[2],
            'opponent': row[3],
            'color': row[4],
            'result': row[5],
            'eco': row[6],
            'time_control': row[7]
        })
    
    conn.close()
    return jsonify(games)

if __name__ == '__main__':
    # Ensure directories exist
    os.makedirs('../uploads', exist_ok=True)
    os.makedirs('../database', exist_ok=True)
    
    # Initialize database
    init_db()
    
    # Run the app
    app.run(debug=True, host='0.0.0.0', port=5001)
