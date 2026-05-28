// ========== ALERT SYSTEM ==========
// Check thresholds and create alerts automatically
function checkAndCreateAlerts(device_id, temperature, humidity, soil_moisture) {
  // Get device info
  const device = db.prepare('SELECT farm_id FROM devices WHERE device_id = ?').get(device_id);
  if (!device) return;
  
  // Get thresholds (default values for farming)
  let thresholds = db.prepare('SELECT * FROM thresholds WHERE farm_id = ?').get(device.farm_id);
  if (!thresholds) {
    // Default farming thresholds
    thresholds = {
      soil_moisture_min: 30,
      soil_moisture_max: 70,
      temperature_min: 15,
      temperature_max: 35,
      humidity_min: 40,
      humidity_max: 80
    };
  }
  
  const now = new Date().toISOString();
  
  // Check SOIL MOISTURE alert (too dry = waste water alert!)
  if (soil_moisture < thresholds.soil_moisture_min) {
    const severity = soil_moisture < 20 ? 'critical' : 'warning';
    db.prepare(`INSERT INTO alerts (farm_id, device_id, type, severity, message, value, threshold, created_at, status)
      VALUES (?, ?, 'soil_moisture', ?, '⚠️ SOIL TOO DRY! Time to irrigate. Water is being wasted if not watered now.', ?, ?, ?)`)
      .run(device.farm_id, device_id, severity, soil_moisture, thresholds.soil_moisture_min, now);
  }
  // Check SOIL MOISTURE alert (too wet)
  else if (soil_moisture > thresholds.soil_moisture_max) {
    const severity = soil_moisture > 80 ? 'critical' : 'warning';
    db.prepare(`INSERT INTO alerts (farm_id, device_id, type, severity, message, value, threshold, created_at, status)
      VALUES (?, ?, 'soil_moisture', ?, '💧 SOIL TOO WET! Stop irrigation to prevent root rot.', ?, ?, ?)`)
      .run(device.farm_id, device_id, severity, soil_moisture, thresholds.soil_moisture_max, now);
  }
  
  // Check TEMPERATURE alert
  if (temperature > thresholds.temperature_max) {
    const severity = temperature > 40 ? 'critical' : 'warning';
    db.prepare(`INSERT INTO alerts (farm_id, device_id, type, severity, message, value, threshold, created_at, status)
      VALUES (?, ?, 'temperature', ?, '🌡️ TEMPERATURE TOO HIGH! Crops at risk. Provide shade or ventilation.', ?, ?, ?)`)
      .run(device.farm_id, device_id, severity, temperature, thresholds.temperature_max, now);
  }
  else if (temperature < thresholds.temperature_min) {
    const severity = temperature < 10 ? 'critical' : 'warning';
    db.prepare(`INSERT INTO alerts (farm_id, device_id, type, severity, message, value, threshold, created_at, status)
      VALUES (?, ?, 'temperature', ?, '❄️ TEMPERATURE TOO LOW! Frost risk. Protect your crops.', ?, ?, ?)`)
      .run(device.farm_id, device_id, severity, temperature, thresholds.temperature_min, now);
  }
  
  // Check HUMIDITY alert
  if (humidity > thresholds.humidity_max) {
    db.prepare(`INSERT INTO alerts (farm_id, device_id, type, severity, message, value, threshold, created_at, status)
      VALUES (?, ?, 'humidity', 'warning', '💨 HIGH HUMIDITY! Risk of fungal diseases. Improve air circulation.', ?, ?, ?)`)
      .run(device.farm_id, device_id, humidity, thresholds.humidity_max, now);
  }
  else if (humidity < thresholds.humidity_min) {
    db.prepare(`INSERT INTO alerts (farm_id, device_id, type, severity, message, value, threshold, created_at, status)
      VALUES (?, ?, 'humidity', 'warning', '🌵 LOW HUMIDITY! Plants may dry out quickly. Consider misting.', ?, ?, ?)`)
      .run(device.farm_id, device_id, humidity, thresholds.humidity_min, now);
  }
}

// Add irrigation recommendation endpoint
app.get('/api/irrigation/:device_id', authMiddleware, (req, res) => {
  const { device_id } = req.params;
  const lastReading = db.prepare(`
    SELECT soil_moisture, recorded_at FROM readings 
    WHERE device_id = ? ORDER BY recorded_at DESC LIMIT 1
  `).get(device_id);
  
  if (!lastReading) {
    return res.json({ recommendation: 'No data available', should_irrigate: false });
  }
  
  let recommendation = '';
  let should_irrigate = false;
  const moisture = lastReading.soil_moisture;
  
  if (moisture < 30) {
    recommendation = '🚨 URGENT: Soil is very dry! Water immediately to save your crops.';
    should_irrigate = true;
  } else if (moisture < 45) {
    recommendation = '⚠️ Soil is getting dry. Plan to irrigate within 24 hours.';
    should_irrigate = true;
  } else if (moisture < 60) {
    recommendation = '✅ Soil moisture is optimal. No irrigation needed.';
    should_irrigate = false;
  } else if (moisture < 75) {
    recommendation = '💧 Soil is moist. Hold off on watering.';
    should_irrigate = false;
  } else {
    recommendation = '🌊 Soil is too wet! Stop irrigation to prevent root rot.';
    should_irrigate = false;
  }
  
  res.json({ 
    soil_moisture: moisture,
    recommendation, 
    should_irrigate,
    last_update: lastReading.recorded_at
  });
});

// Get active alerts for dashboard
app.get('/api/alerts/active', authMiddleware, (req, res) => {
  const alerts = db.prepare(`
    SELECT a.*, f.name as farm_name, d.name as device_name
    FROM alerts a
    JOIN farms f ON a.farm_id = f.id
    LEFT JOIN devices d ON a.device_id = d.device_id
    WHERE f.user_id = ? AND a.status = 'active'
    ORDER BY a.created_at DESC
    LIMIT 20
  `).all(req.user.id);
  res.json(alerts);
});

// Acknowledge alert (farmer has seen it)
app.post('/api/alerts/:id/acknowledge', authMiddleware, (req, res) => {
  db.prepare(`UPDATE alerts SET status = 'acknowledged', acknowledged_at = CURRENT_TIMESTAMP
    WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});
