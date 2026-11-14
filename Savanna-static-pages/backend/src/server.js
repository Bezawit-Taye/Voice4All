/**
 * Voice4All Shared Backend Foundation & Server
 * Phase 1: Core Express setup, Tutor routes, and Router Mounting for Support & Career
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const tutorRoutes = require('./routes/tutor.routes');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 1. CORS Configuration
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : ['*'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// 2. Request Parsing Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 3. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'voice4all-backend',
    version: '1.0.0',
    environment: NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    aiProvider: process.env.AI_PROVIDER || 'mock_demo',
    mountedEndpoints: [
      { path: '/api/health', status: 'ready' },
      { path: '/api/tutor', status: 'ready' },
      { path: '/api/support', status: 'mounted' },
      { path: '/api/career', status: 'mounted' }
    ]
  });
});

// 4. Tutor Routes
app.use('/api/tutor', tutorRoutes);

// 5. Support Router Mounting (Designed for Member 3 integration)
const supportRouteFile = path.join(__dirname, 'routes', 'support.routes.js');
if (fs.existsSync(supportRouteFile)) {
  try {
    const supportRoutes = require('./routes/support.routes');
    app.use('/api/support', supportRoutes.default || supportRoutes);
    console.log('[Router] Support router successfully loaded from routes/support.routes.js');
  } catch (err) {
    console.error('[Router] Failed to load routes/support.routes.js:', err.message);
  }
} else {
  // Graceful mount handler until Member 3 adds support.routes.js
  app.use('/api/support', (req, res) => {
    res.status(501).json({
      status: 'pending_member_3',
      message: 'Support route is mounted at /api/support. Implementation will be attached by Member 3.',
      requestedPath: req.originalUrl,
      method: req.method
    });
  });
}

// 6. Career Router Mounting (Designed for Member 3 integration)
const careerRouteFile = path.join(__dirname, 'routes', 'career.routes.js');
if (fs.existsSync(careerRouteFile)) {
  try {
    const careerRoutes = require('./routes/career.routes');
    app.use('/api/career', careerRoutes.default || careerRoutes);
    console.log('[Router] Career router successfully loaded from routes/career.routes.js');
  } catch (err) {
    console.error('[Router] Failed to load routes/career.routes.js:', err.message);
  }
} else {
  // Graceful mount handler until Member 3 adds career.routes.js
  app.use('/api/career', (req, res) => {
    res.status(501).json({
      status: 'pending_member_3',
      message: 'Career route is mounted at /api/career. Implementation will be attached by Member 3.',
      requestedPath: req.originalUrl,
      method: req.method
    });
  });
}

// 7. 404 Route Handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    error: `Not Found: ${req.method} ${req.originalUrl}`
  });
});

// 8. Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err.message);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    error: err.message || 'Internal Server Error'
  });
});

// Start server if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Voice4All Backend running on http://localhost:${PORT}`);
    console.log(`- Health Check: http://localhost:${PORT}/api/health`);
    console.log(`- Tutor Ask:    POST http://localhost:${PORT}/api/tutor/ask`);
    console.log(`- Support API:  http://localhost:${PORT}/api/support`);
    console.log(`- Career API:   http://localhost:${PORT}/api/career`);
  });
}

module.exports = app;

