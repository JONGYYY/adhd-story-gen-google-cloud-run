const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('=== RAILWAY TEST SERVER STARTING ===');
console.log('Node.js version:', process.version);
console.log('Port:', PORT);
console.log('Environment:', process.env.NODE_ENV || 'development');

app.get('/', (req, res) => {
  res.json({ message: 'Railway test server is running!', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'railway-test' });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
}); 