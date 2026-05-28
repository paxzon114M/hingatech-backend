CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER,
  device_id TEXT,
  type TEXT,
  severity TEXT,
  message TEXT,
  value REAL,
  threshold REAL,
  created_at DATETIME,
  status TEXT DEFAULT 'active',
  acknowledged_at DATETIME
);
