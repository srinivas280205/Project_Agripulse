// Vercel Serverless — Smart Market Demand & Sell Decision Engine

// Tamil Nadu Mandi locations with GPS
const MANDIS = [
  { id:'erode',    name:'Erode Mandi',     tamil:'ஈரோடு மண்டி',     lat:11.341, lon:77.717, district:'Erode' },
  { id:'coimbatore',name:'Coimbatore Mandi',tamil:'கோயம்புத்தூர் மண்டி',lat:11.017,lon:76.956,district:'Coimbatore'},
  { id:'salem',    name:'Salem Mandi',      tamil:'சேலம் மண்டி',      lat:11.664, lon:78.146, district:'Salem' },
  { id:'madurai',  name:'Madurai Mandi',    tamil:'மதுரை மண்டி',      lat:9.925,  lon:78.120, district:'Madurai' },
  { id:'trichy',   name:'Trichy Mandi',     tamil:'திருச்சி மண்டி',   lat:10.790, lon:78.705, district:'Trichy' },
  { id:'thanjavur',name:'Thanjavur Mandi',  tamil:'தஞ்சாவூர் மண்டி', lat:10.787, lon:79.138, district:'Thanjavur' },
  { id:'tirunelveli',name:'Tirunelveli Mandi',tamil:'திருநெல்வேலி மண்டி',lat:8.714,lon:77.757,district:'Tirunelveli'},
  { id:'krishnagiri',name:'Krishnagiri Mandi',tamil:'கிருஷ்ணகிரி மண்டி',lat:12.519,lon:78.213,district:'Krishnagiri'},
  { id:'dindigul', name:'Dindigul Mandi',   tamil:'திண்டுக்கல் மண்டி',lat:10.366, lon:77.970, district:'Dindigul' },
  { id:'vellore',  name:'Vellore Mandi',    tamil:'வேலூர் மண்டி',     lat:12.917, lon:79.133, district:'Vellore' },
];

// Crop base prices (₹/quintal) — realistic 2024-2025 TN market data
const BASE_PRICES = {
  'Paddy':     { base:2200, min:1900, max:2600, unit:'quintal', season:[10,11,0,1] },
  'Tomato':    { base:2000, min:500,  max:5000, unit:'quintal', season:[1,2,9,10] },
  'Onion':     { base:2500, min:1200, max:4500, unit:'quintal', season:[1,2,3,10,11] },
  'Banana':    { base:1400, min:800,  max:2200, unit:'quintal', season:[0,1,2,11] },
  'Sugarcane': { base:3200, min:2800, max:3600, unit:'quintal', season:[11,0,1,2] },
  'Groundnut': { base:5800, min:4800, max:6800, unit:'quintal', season:[9,10,11] },
  'Cotton':    { base:6500, min:5500, max:7500, unit:'quintal', season:[10,11,0] },
  'Maize':     { base:2000, min:1600, max:2400, unit:'quintal', season:[9,10] },
  'Turmeric':  { base:8000, min:6000, max:12000,unit:'quintal', season:[0,1,2] },
  'Chilli':    { base:9000, min:6000, max:14000,unit:'quintal', season:[1,2,3] },
  'Coconut':   { base:2800, min:1800, max:3800, unit:'100 nuts',season:[0,1,2,3,4,5,6,7,8,9,10,11] },
  'Brinjal':   { base:1200, min:400,  max:2500, unit:'quintal', season:[0,1,2,3,10,11] },
};

// Each mandi has different specialty and demand patterns
const MANDI_SPECIALTY = {
  erode:      { crops:['Turmeric','Cotton','Groundnut'], demandFactor:1.15 },
  coimbatore: { crops:['Maize','Vegetables','Cotton'],   demandFactor:1.10 },
  salem:      { crops:['Mango','Tomato','Onion'],        demandFactor:1.08 },
  madurai:    { crops:['Banana','Paddy','Jasmine'],      demandFactor:1.12 },
  trichy:     { crops:['Paddy','Groundnut','Banana'],    demandFactor:1.06 },
  thanjavur:  { crops:['Paddy','Banana','Sugarcane'],    demandFactor:1.14 },
  tirunelveli:{ crops:['Banana','Paddy','Coconut'],      demandFactor:1.09 },
  krishnagiri:{ crops:['Tomato','Mango','Vegetables'],   demandFactor:1.18 },
  dindigul:   { crops:['Onion','Chilli','Garlic'],       demandFactor:1.11 },
  vellore:    { crops:['Groundnut','Paddy','Mango'],     demandFactor:1.07 },
};

function seededRandom(seed) {
  return ((Math.sin(seed) * 9301 + 49297) % 233280) / 233280;
}

function getPriceForMandi(mandiId, crop, dateSeed, rainFactor) {
  const bp = BASE_PRICES[crop];
  if (!bp) return null;
  const spec = MANDI_SPECIALTY[mandiId];
  const isSpecialty = spec && spec.crops.some(c => c.toLowerCase() === crop.toLowerCase());
  
  // Price variation: specialty mandis pay more, demand drives price
  const demandFactor = isSpecialty ? spec.demandFactor : 0.95 + seededRandom(dateSeed + mandiId.length) * 0.1;
  const dailyVar = (seededRandom(dateSeed * mandiId.charCodeAt(0)) - 0.5) * 0.12;
  const rainEffect = rainFactor > 10 ? -0.08 : rainFactor > 5 ? -0.04 : 0.03; // rain reduces prices
  
  const curMonth = new Date().getMonth();
  const inSeason = bp.season.includes(curMonth);
  const seasonFactor = inSeason ? 1.0 : 0.88;
  
  const price = Math.round(bp.base * demandFactor * (1 + dailyVar + rainEffect) * seasonFactor);
  const clampedPrice = Math.max(bp.min, Math.min(bp.max, price));
  
  // Demand level based on specialty and price
  let demand, demandTa;
  if (isSpecialty && clampedPrice > bp.base * 1.05) {
    demand = 'HIGH'; demandTa = 'அதிக தேவை';
  } else if (clampedPrice > bp.base * 0.98) {
    demand = 'MEDIUM'; demandTa = 'நடுத்தர தேவை';
  } else {
    demand = 'LOW'; demandTa = 'குறைந்த தேவை';
  }

  return {
    price: clampedPrice,
    demand, demandTa,
    isSpecialty,
    priceChange: Math.round((clampedPrice - bp.base) / bp.base * 100),
  };
}

function getDistance(lat1, lon1, lat2, lon2) {
  return Math.round(Math.sqrt(Math.pow(lat1-lat2,2)+Math.pow(lon1-lon2,2))*111);
}

function generateSellDecision(mandiData, crop, rainNext3, qty) {
  const sorted = [...mandiData].sort((a,b)=>b.price-a.price);
  const best = sorted[0];
  const worst = sorted[sorted.length-1];
  const priceDiff = best.price - worst.price;
  const profitExtra = Math.round((priceDiff * qty) / 100); // qty in kg, price per quintal

  let decision = '', decisionTa = '', urgency = '';
  
  if (rainNext3 > 20 && best.demand === 'HIGH') {
    decision = `SELL TODAY at ${best.name}`;
    decisionTa = `இன்றே ${best.tamil} இல் விற்கவும்`;
    urgency = 'HIGH';
  } else if (rainNext3 > 15) {
    decision = `SELL IN NEXT 2 DAYS at ${best.name}`;
    decisionTa = `அடுத்த 2 நாளில் ${best.tamil} இல் விற்கவும்`;
    urgency = 'MEDIUM';
  } else if (best.demand === 'HIGH') {
    decision = `SELL NOW at ${best.name} — High demand`;
    decisionTa = `இப்போதே ${best.tamil} இல் விற்கவும் — அதிக தேவை`;
    urgency = 'HIGH';
  } else if (best.demand === 'LOW') {
    decision = `WAIT 2-3 DAYS — Prices expected to rise`;
    decisionTa = `2-3 நாள் காத்திருங்கள் — விலை உயரும் வாய்ப்பு`;
    urgency = 'LOW';
  } else {
    decision = `SELL at ${best.name} for best price`;
    decisionTa = `சிறந்த விலைக்கு ${best.tamil} இல் விற்கவும்`;
    urgency = 'MEDIUM';
  }

  return { decision, decisionTa, urgency, bestMandi: best, priceDiff, profitExtra };
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { lat, lon, crop, qty, rain3 } = req.query;
  if (!lat || !lon || !crop) return res.status(400).json({ error: 'lat, lon, crop required' });

  const parsedLat = parseFloat(lat), parsedLon = parseFloat(lon);
  const quantity = parseFloat(qty) || 100; // kg
  const rainNext3 = parseFloat(rain3) || 0;
  const today = new Date();
  const dateSeed = today.getFullYear()*10000 + (today.getMonth()+1)*100 + today.getDate();

  // Get nearest 6 mandis
  const mandisWithDist = MANDIS.map(m => ({
    ...m,
    distance_km: getDistance(parsedLat, parsedLon, m.lat, m.lon)
  })).sort((a,b)=>a.distance_km-b.distance_km).slice(0,6);

  // Get prices and demand for each mandi
  const mandiData = mandisWithDist.map(m => {
    const pd = getPriceForMandi(m.id, crop, dateSeed, rainNext3);
    return {
      ...m,
      price: pd ? pd.price : null,
      demand: pd ? pd.demand : 'UNKNOWN',
      demandTa: pd ? pd.demandTa : 'தெரியாது',
      isSpecialty: pd ? pd.isSpecialty : false,
      priceChange: pd ? pd.priceChange : 0,
      unit: BASE_PRICES[crop]?.unit || 'quintal',
    };
  }).filter(m => m.price !== null);

  const sellDecision = generateSellDecision(mandiData, crop, rainNext3, quantity);
  const bp = BASE_PRICES[crop];

  res.json({
    crop, quantity,
    mandiData,
    sellDecision,
    basePrice: bp?.base || 0,
    unit: bp?.unit || 'quintal',
    rainWarning: rainNext3 > 15,
    timestamp: today.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  });
};
