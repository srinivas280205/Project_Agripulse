from flask import Flask, jsonify, request, send_from_directory
import requests, math, os, json
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='static')

# ── WEATHER ─────────────────────────────────────────────
def get_weather(lat, lon):
    url = (f"https://api.open-meteo.com/v1/forecast"
           f"?latitude={lat}&longitude={lon}"
           f"&current=temperature_2m,relative_humidity_2m,precipitation,"
           f"wind_speed_10m,weather_code,uv_index"
           f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
           f"weathercode,uv_index_max"
           f"&forecast_days=7&timezone=Asia%2FKolkata")
    r = requests.get(url, timeout=6)
    return r.json()

# ── MANDI PRICES (date-seeded daily) ────────────────────
def mandi_prices():
    d = datetime.now()
    s = d.year * 10000 + d.month * 100 + d.day
    rng = lambda x: ((math.sin(x) * 9301 + 49297) % 233280) / 233280
    return {
        "Paddy (Raw)":  round(2100 + rng(s*1)*300),
        "Tomato":       round(1200 + rng(s*2)*1000),
        "Onion":        round(2000 + rng(s*3)*800),
        "Banana":       round(1000 + rng(s*4)*400),
        "Sugarcane":    round(3100 + rng(s*5)*200),
        "Groundnut":    round(5500 + rng(s*6)*600),
        "Cotton":       round(6200 + rng(s*7)*500),
        "Maize":        round(1800 + rng(s*8)*300),
    }

# ── SOIL DETECTOR ────────────────────────────────────────
def detect_soil(lat, lon):
    # Region-based soil classification for Tamil Nadu
    if lat > 12.5:
        return {"type": "Red Loamy Soil", "tamil": "சிவப்பு மண்", "ph": "6.0-7.0",
                "crops": "Groundnut, Millets, Cotton", "fertility": "Medium",
                "tip": "Add organic compost to improve water retention."}
    elif lat > 11.5:
        return {"type": "Black Cotton Soil", "tamil": "கரிசல் மண்", "ph": "7.5-8.5",
                "crops": "Cotton, Sorghum, Wheat", "fertility": "High",
                "tip": "Excellent for cotton. Ensure proper drainage."}
    elif lat > 10.5:
        return {"type": "Alluvial Soil", "tamil": "வண்டல் மண்", "ph": "6.5-7.5",
                "crops": "Paddy, Sugarcane, Banana", "fertility": "Very High",
                "tip": "Very fertile. Ideal for paddy and sugarcane cultivation."}
    else:
        return {"type": "Laterite Soil", "tamil": "லேட்டரைட் மண்", "ph": "5.5-6.5",
                "crops": "Coconut, Rubber, Tapioca", "fertility": "Low-Medium",
                "tip": "Apply lime to reduce acidity. Good for plantation crops."}

# ── YIELD PREDICTION ─────────────────────────────────────
def predict_yield(lat, lon, crop, weather):
    base_yields = {
        "Paddy": 4.2, "Tomato": 25.0, "Onion": 15.0,
        "Sugarcane": 80.0, "Groundnut": 2.0, "Cotton": 1.8,
        "Maize": 5.5, "Banana": 30.0
    }
    base = base_yields.get(crop, 5.0)
    temp = weather.get("temperature", 28)
    humid = weather.get("humidity", 65)
    rain = weather.get("precipitation", 2)

    factor = 1.0
    if 22 <= temp <= 35: factor += 0.1
    elif temp > 40: factor -= 0.25
    elif temp < 15: factor -= 0.2
    if 55 <= humid <= 80: factor += 0.05
    elif humid > 85: factor -= 0.1
    if rain > 5: factor += 0.05

    predicted = round(base * max(0.4, min(1.4, factor)), 2)
    percent = round((predicted / base) * 100)
    status = "Excellent" if percent >= 100 else "Good" if percent >= 85 else "Average" if percent >= 70 else "Below Average"
    return {"crop": crop, "predicted_yield": predicted, "base_yield": base,
            "percent": percent, "status": status,
            "unit": "tonnes/hectare" if crop != "Sugarcane" else "tonnes/hectare"}

# ── NEARBY KVK ───────────────────────────────────────────
def nearby_kvk(lat, lon):
    kvks = [
        {"name": "KVK Coimbatore", "district": "Coimbatore", "lat": 11.0168, "lon": 76.9558,
         "phone": "0422-2441248", "email": "kvk.coimbatore@icar.gov.in"},
        {"name": "KVK Erode", "district": "Erode", "lat": 11.3410, "lon": 77.7172,
         "phone": "0424-2225684", "email": "kvk.erode@icar.gov.in"},
        {"name": "KVK Salem", "district": "Salem", "lat": 11.6643, "lon": 78.1460,
         "phone": "0427-2345123", "email": "kvk.salem@icar.gov.in"},
        {"name": "KVK Tiruppur", "district": "Tiruppur", "lat": 11.1085, "lon": 77.3411,
         "phone": "0421-2241567", "email": "kvk.tiruppur@icar.gov.in"},
        {"name": "KVK Madurai", "district": "Madurai", "lat": 9.9252, "lon": 78.1198,
         "phone": "0452-2380345", "email": "kvk.madurai@icar.gov.in"},
        {"name": "KVK Chennai", "district": "Chennai", "lat": 13.0827, "lon": 80.2707,
         "phone": "044-22350129", "email": "kvk.chennai@icar.gov.in"},
        {"name": "KVK Trichy", "district": "Tiruchirappalli", "lat": 10.7905, "lon": 78.7047,
         "phone": "0431-2401234", "email": "kvk.trichy@icar.gov.in"},
        {"name": "KVK Vellore", "district": "Vellore", "lat": 12.9165, "lon": 79.1325,
         "phone": "0416-2245678", "email": "kvk.vellore@icar.gov.in"},
    ]
    # Sort by distance
    def dist(k):
        return math.sqrt((k["lat"]-lat)**2 + (k["lon"]-lon)**2)
    kvks.sort(key=dist)
    nearest = kvks[:3]
    for k in nearest:
        d = dist(k)
        k["distance_km"] = round(d * 111, 1)
    return nearest

# ── ROUTES ───────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/api/advisory")
def advisory():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    if not lat or not lon:
        return jsonify({"error": "lat and lon required"}), 400
    try:
        wd = get_weather(lat, lon)
        c = wd["current"]
        daily = wd.get("daily", {})
        weather = {
            "temperature": c["temperature_2m"],
            "humidity": c["relative_humidity_2m"],
            "precipitation": c["precipitation"],
            "wind_speed": c["wind_speed_10m"],
            "weather_code": c["weather_code"],
            "uv_index": c.get("uv_index", 0),
        }
        forecast = []
        if daily:
            dates = daily.get("time", [])
            for i in range(min(7, len(dates))):
                forecast.append({
                    "date": dates[i],
                    "max": daily["temperature_2m_max"][i],
                    "min": daily["temperature_2m_min"][i],
                    "rain": daily["precipitation_sum"][i],
                    "code": daily["weathercode"][i],
                    "uv": daily.get("uv_index_max", [0]*7)[i],
                })
        soil = detect_soil(lat, lon)
        kvk = nearby_kvk(lat, lon)
        prices = mandi_prices()
        return jsonify({
            "weather": weather,
            "forecast": forecast,
            "soil": soil,
            "mandi": prices,
            "kvk": kvk,
            "timestamp": datetime.now().strftime("%d %b %Y, %I:%M %p"),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/yield")
def yield_api():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    crop = request.args.get("crop", "Paddy")
    temp = request.args.get("temp", type=float, default=28)
    humid = request.args.get("humid", type=float, default=65)
    rain = request.args.get("rain", type=float, default=2)
    weather = {"temperature": temp, "humidity": humid, "precipitation": rain}
    return jsonify(predict_yield(lat or 11.0, lon or 78.0, crop, weather))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)