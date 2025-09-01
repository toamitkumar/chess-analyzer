# Chess Analysis Portal

## 📁 Project Structure

```
chess-portal/
├── backend/           # Python Flask/FastAPI backend
├── frontend/          # HTML/CSS/JS frontend components  
├── database/          # Database schemas and migrations
├── static/            # Static assets
│   ├── css/          # Stylesheets
│   ├── js/           # JavaScript files
│   └── images/       # Images and icons
├── templates/         # HTML templates
├── uploads/          # PGN file uploads
├── config/           # Configuration files
└── requirements.txt  # Python dependencies
```

## 🎯 Portal Features

- **Dashboard** - Real-time metrics and performance overview
- **Game Analysis** - Upload PGNs for Stockfish analysis  
- **Progress Tracking** - Weekly improvement monitoring
- **Game Browser** - Drill down from stats to individual games
- **Engine Selection** - Choose analysis engine (Stockfish, Leela, etc.)

## 🚀 Quick Start

1. Install dependencies: `pip install -r requirements.txt`
2. Run backend: `python backend/app.py`
3. Open browser: `http://localhost:5000`

## 📊 Data Sources

- Existing analysis data from `../analysis-*/`
- New PGN uploads via web interface
- Real-time Stockfish analysis integration
