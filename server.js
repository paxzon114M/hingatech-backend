const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// File to store readings
const DATA_FILE = path.join(__dirname, 'readings.json');

// Helper to read readings
function getReadings() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return []; // file doesn't exist yet
  }
}

// Helper to save readings
function saveReadings(readings) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(readings, null, 2));
}

// POST /api/sensor
app.post('/api/sensor', (req, res) => {
  const { device_id, temperature, humidity, soil_moisture } = req.body;
  if (!device_id || temperature == null || humidity == null || soil_moisture == null) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const readings = getReadings();
  const newReading = {
    id: readings.length + 1,
    device_id,
    temperature,
    humidity,
    soil_moisture,
    recorded_at: new Date().toISOString()
  };
  readings.push(newReading);
  saveReadings(readings);
  res.status(201).json({ message: 'Reading saved', id: newReading.id });
});

// GET /api/sensor/latest
app.get('/api/sensor/latest', (req, res) => {
  const readings = getReadings();
  // Group by device_id, get latest per device
  const latestMap = new Map();
  for (const r of readings.slice().reverse()) { // from newest to oldest
    if (!latestMap.has(r.device_id)) {
      latestMap.set(r.device_id, r);
    }
  }
  const latest = Array.from(latestMap.values());
  res.json(latest);
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});