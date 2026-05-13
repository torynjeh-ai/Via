const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes    = require('./routes/auth');
const groupRoutes   = require('./routes/groups');
const userRoutes    = require('./routes/users');
const receiptRoutes = require('./routes/receipts');
const termsRoutes   = require('./routes/terms');
const walletRoutes  = require('./routes/wallet');
const messageRoutes = require('./routes/messages');
const adminRoutes   = require('./routes/admin');
const savingsRoutes = require('./routes/savings');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Base64 images (document + selfie) can be ~300–500 KB each; allow up to 10 MB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(apiLimiter);

app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/groups/:id/messages', messageRoutes);
app.use('/admin', adminRoutes);
app.use('/savings', savingsRoutes);
app.use('/users', userRoutes);
app.use('/receipts', receiptRoutes);
app.use('/terms', termsRoutes);
app.use('/wallet', walletRoutes);

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

module.exports = app;
