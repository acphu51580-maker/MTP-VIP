const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'MTP';
const ADMIN_PASS = process.env.ADMIN_PASS || 'MTP313';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'mtp-secret-2024';
const DB_FILE = path.join('/tmp', 'keys.json');

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ keys: [] }));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { keys: [] };
  }
}
function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
}

function randomHex(len) {
  const chars = '0123456789ABCDEF';
  let r = '';
  for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}
function generateKey() {
  return 'VL-' + randomHex(8) + '-' + randomHex(8) + '-' + randomHex(8);
}

function authAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.body.token || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, message: 'Token khong hop le' });
  }
  next();
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Game License Server dang chay' });
});

app.post('/api/keys', authAdmin, (req, res) => {
  const maxTB = req.body.maxTB || 1;
  const duration = req.body.duration || '2h';
  const note = req.body.note || '';
  
  const db = loadDB();
  const newKey = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    key: generateKey(),
    maxTB: maxTB,
    duration: duration,
    note: note,
    status: 'active',
    usedBy: [],
    createdAt: Date.now(),
    expiresAt: duration === 'perm' ? null : Date.now() + parseDuration(duration)
  };
  db.keys.push(newKey);
  saveDB(db);
  res.json({ success: true, key: newKey });
});

app.get('/api/keys', authAdmin, (req, res) => {
  const db = loadDB();
  res.json({ success: true, keys: db.keys });
});

app.delete('/api/keys/:id', authAdmin, (req, res) => {
  const db = loadDB();
  db.keys = db.keys.filter(k => k.id !== req.params.id);
  saveDB(db);
  res.json({ success: true });
});

app.post('/api/verify', (req, res) => {
  const key = req.body.key;
  const deviceId = req.body.deviceId;
  const db = loadDB();
  const found = db.keys.find(k => k.key === key);
  if (!found) return res.status(404).json({ success: false, message: 'Key khong ton tai' });
  if (found.status !== 'active') return res.status(403).json({ success: false, message: 'Key da tat' });
  if (found.expiresAt && Date.now() > found.expiresAt) {
    return res.status(403).json({ success: false, message: 'Key het han' });
  }
  if (deviceId && found.usedBy.indexOf(deviceId) === -1) {
    if (found.usedBy.length >= found.maxTB) {
      return res.status(403).json({ success: false, message: 'Het slot thiet bi' });
    }
    found.usedBy.push(deviceId);
    saveDB(db);
  }
  res.json({ success: true, key: found });
});

function parseDuration(str) {
  const map = {
    '1h': 3600000, '2h': 7200000, '6h': 21600000, '10h': 36000000,
    '12h': 43200000, '24h': 86400000, '1d': 86400000, '3d': 259200000,
    '7d': 604800000, '30d': 2592000000, '60d': 5184000000
  };
  return map[str] || 7200000;
}

app.listen(PORT, () => {
  console.log('Server chay tai port ' + PORT);
  console.log('Admin Token: ' + ADMIN_TOKEN);
});
