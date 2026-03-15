// Vercel Serverless Function — Weather + Soil + KVK
const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function detectSoil(lat, lon) {
  // Tamil Nadu soil zones based on agricultural survey data
  if (lat > 13.0) return { type:'Red Loamy Soil', tamil:'சிவப்பு மண்', ph:'6.0-7.0', crops:'Groundnut, Millets, Cotton', fertility:'Medium', tip:'Add organic compost to improve water retention and nutrient availability.' };
  if (lat > 12.0 && lon > 79.0) return { type:'Alluvial Soil', tamil:'வண்டல் மண்', ph:'6.5-7.5', crops:'Paddy, Sugarcane, Banana', fertility:'Very High', tip:'Excellent for paddy. Ensure proper drainage to avoid waterlogging.' };
  if (lat > 11.5 && lon < 77.5) return { type:'Black Cotton Soil', tamil:'கரிசல் மண்', ph:'7.5-8.5', crops:'Cotton, Sorghum, Groundnut', fertility:'High', tip:'Very fertile. Avoid over-irrigation. Best for cotton and sorghum.' };
  if (lat > 10.5) return { type:'Alluvial Soil', tamil:'வண்டல் மண்', ph:'6.5-7.5', crops:'Paddy, Banana, Vegetables', fertility:'Very High', tip:'Rich delta soil. Ideal for paddy and banana cultivation.' };
  if (lat > 9.5) return { type:'Red Sandy Soil', tamil:'சிவப்பு மணல் மண்', ph:'5.5-6.5', crops:'Coconut, Cashew, Tapioca', fertility:'Low-Medium', tip:'Add compost and lime. Good for coconut and plantation crops.' };
  return { type:'Laterite Soil', tamil:'லேட்டரைட் மண்', ph:'5.0-6.0', crops:'Coconut, Rubber, Pepper', fertility:'Low', tip:'Apply lime to reduce acidity. Suitable for plantation crops.' };
}

function nearbyKVK(lat, lon) {
  const kvks = [
    { name:'KVK Coimbatore', district:'Coimbatore', lat:11.0168, lon:76.9558, phone:'0422-2441248', email:'kvkcoimbatore@icar.gov.in', crops:['Cotton','Maize','Vegetables'] },
    { name:'KVK Erode', district:'Erode', lat:11.3410, lon:77.7172, phone:'0424-2225684', email:'kvkerode@icar.gov.in', crops:['Turmeric','Sugarcane','Cotton'] },
    { name:'KVK Salem', district:'Salem', lat:11.6643, lon:78.1460, phone:'0427-2345123', email:'kvksalem@icar.gov.in', crops:['Mango','Tapioca','Paddy'] },
    { name:'KVK Madurai', district:'Madurai', lat:9.9252, lon:78.1198, phone:'0452-2380345', email:'kvkmadurai@icar.gov.in', crops:['Paddy','Banana','Flowers'] },
    { name:'KVK Trichy', district:'Tiruchirappalli', lat:10.7905, lon:78.7047, phone:'0431-2401234', email:'kvktrichy@icar.gov.in', crops:['Paddy','Groundnut','Pulses'] },
    { name:'KVK Thanjavur', district:'Thanjavur', lat:10.7870, lon:79.1378, phone:'04362-240987', email:'kvkthanjavur@icar.gov.in', crops:['Paddy','Banana','Sugarcane'] },
    { name:'KVK Tirunelveli', district:'Tirunelveli', lat:8.7139, lon:77.7567, phone:'0462-2578901', email:'kvktirunelveli@icar.gov.in', crops:['Banana','Paddy','Vegetables'] },
    { name:'KVK Vellore', district:'Vellore', lat:12.9165, lon:79.1325, phone:'0416-2245678', email:'kvkvellore@icar.gov.in', crops:['Groundnut','Paddy','Sugarcane'] },
  ];
  const sorted = kvks.map(k => ({
    ...k,
    distance_km: Math.round(Math.sqrt(Math.pow(k.lat-lat,2)+Math.pow(k.lon-lon,2))*111)
  })).sort((a,b)=>a.distance_km-b.distance_km);
  return sorted.slice(0,3);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Asia%2FKolkata`;
    const wd = await fetchJSON(weatherUrl);
    const c = wd.current;
    const daily = wd.daily || {};

    const forecast = (daily.time||[]).map((date, i) => ({
      date, max: daily.temperature_2m_max[i], min: daily.temperature_2m_min[i],
      rain: daily.precipitation_sum[i], code: daily.weathercode[i],
      uv: (daily.uv_index_max||[])[i] || 0
    }));

    // Check rain in next 3 days
    const rainNext3 = forecast.slice(0,3).reduce((s,d)=>s+d.rain,0);
    const rainNext24 = forecast[0]?.rain || 0;

    res.json({
      weather: {
        temperature: c.temperature_2m, humidity: c.relative_humidity_2m,
        precipitation: c.precipitation, wind_speed: c.wind_speed_10m,
        weather_code: c.weather_code, uv_index: c.uv_index || 0
      },
      forecast, rainNext3, rainNext24,
      soil: detectSoil(parseFloat(lat), parseFloat(lon)),
      kvk: nearbyKVK(parseFloat(lat), parseFloat(lon)),
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
