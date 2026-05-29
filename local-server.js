const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 3232;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount all /api handlers
const apiDir = path.join(__dirname, 'api');
fs.readdirSync(apiDir).forEach(file => {
  if (!file.endsWith('.js')) return;
  const name    = file.replace('.js', '');
  const handler = require(path.join(apiDir, file));
  app.all(`/api/${name}`, handler);
  console.log(`  ✓ /api/${name}`);
});

// Static files + SPA fallback
app.use(express.static(__dirname));
app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  DOUYIN LAUNCHER → http://localhost:${PORT}\n`);
});
