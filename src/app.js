const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const userRoutes = require('./routes/users');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(apiLimiter);

// Routes
app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/users', userRoutes);

// Health check
app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

module.exports = app;
