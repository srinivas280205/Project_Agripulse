# AgriPulse — Project Setup Guide

## 📁 Folder Structure
```
agripulse/
├── app.py                  ← Flask backend (run this)
├── requirements.txt        ← Python dependencies
└── static/
    └── index.html          ← Frontend (auto-served by Flask)
```

## 🚀 How to Run (Step by Step)

### Step 1 — Install Python dependencies
```bash
pip install -r requirements.txt
```

### Step 2 — Run the Flask server
```bash
python app.py
```

### Step 3 — Open your browser
```
http://localhost:5000
```

### Step 4 — Use the app
- You'll see a satellite map of Tamil Nadu
- Click any point on a field
- The right panel fills with real-time weather + advisory
- Press 🔊 to hear the advice spoken aloud

---

## 🔌 APIs Used (All Free, No Key Needed)
| API | What it does |
|-----|-------------|
| Open-Meteo | Real-time weather by GPS coordinate |
| Esri Satellite Tiles | High-res satellite imagery |
| Leaflet.js | Interactive map rendering |
| Web Speech API | Voice TTS (built into browser) |

---

## 🧠 How the Code Works

### Backend (app.py)
1. User clicks map → frontend sends `GET /api/advisory?lat=X&lon=Y`
2. Flask calls Open-Meteo API with those coordinates
3. Weather data goes through the **Agricultural Rules Engine**
4. Rules engine generates irrigation, pest, and spraying advice
5. Backend also returns simulated Mandi prices and disease scan
6. All data returned as JSON

### Frontend (static/index.html)
1. Leaflet.js renders satellite imagery
2. On map click → `fetch('/api/advisory?lat=X&lon=Y')`
3. Response rendered into the advisory panel
4. Voice button reads the advisory using browser's TTS

---

## 🏆 SIH Judging Points
- ✅ Zero hardware required
- ✅ Coordinate-specific (not just city-level)
- ✅ Voice-first for low-literacy users
- ✅ Flask backend ready for AI/ML expansion
- ✅ Economic empowerment via Mandi prices
