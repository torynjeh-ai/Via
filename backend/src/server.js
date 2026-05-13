require('dotenv').config();
const http   = require('http');
const { Server } = require('socket.io');
const app    = require('./app');
const { pool, query } = require('./config/database');
const logger = require('./utils/logger');
const jwt    = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'];

// Create HTTP server so Socket.io can share the same port
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ── Socket.io auth middleware ──────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result  = await query(
      'SELECT id, name, profile_picture_url FROM users WHERE id = $1 AND is_active = TRUE',
      [decoded.userId]
    );
    if (!result.rows[0]) return next(new Error('User not found'));
    socket.user = result.rows[0];
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// ── Socket.io connection handler ──────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`[Chat] ${socket.user.name} connected`);

  // Join a group chat room
  socket.on('join_group', async ({ groupId }) => {
    try {
      // Verify user is an approved member
      const memberRes = await query(
        `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
        [groupId, socket.user.id]
      );
      if (!memberRes.rows[0]) {
        socket.emit('error', { message: 'Not a member of this group' });
        return;
      }

      socket.join(`group:${groupId}`);
      socket.currentGroupId = groupId;

      // Send last 50 messages on join
      const messagesRes = await query(
        `SELECT m.id, m.message, m.is_system, m.created_at,
                u.id as user_id, u.name, u.profile_picture_url
         FROM group_messages m
         LEFT JOIN users u ON m.user_id = u.id
         WHERE m.group_id = $1
         ORDER BY m.created_at ASC
         LIMIT 50`,
        [groupId]
      );
      socket.emit('message_history', messagesRes.rows);
    } catch (err) {
      logger.error(`[Chat] join_group error: ${err.message}`);
    }
  });

  // Send a message
  socket.on('send_message', async ({ groupId, message }) => {
    try {
      if (!message?.trim()) return;
      if (message.length > 1000) {
        socket.emit('error', { message: 'Message too long (max 1000 characters)' });
        return;
      }

      // Verify membership
      const memberRes = await query(
        `SELECT id FROM members WHERE group_id = $1 AND user_id = $2 AND status = 'approved'`,
        [groupId, socket.user.id]
      );
      if (!memberRes.rows[0]) return;

      const result = await query(
        `INSERT INTO group_messages (group_id, user_id, message)
         VALUES ($1, $2, $3)
         RETURNING id, message, is_system, created_at`,
        [groupId, socket.user.id, message.trim()]
      );

      const msg = {
        ...result.rows[0],
        user_id:             socket.user.id,
        name:                socket.user.name,
        profile_picture_url: socket.user.profile_picture_url,
      };

      // Broadcast to everyone in the room (including sender)
      io.to(`group:${groupId}`).emit('new_message', msg);
    } catch (err) {
      logger.error(`[Chat] send_message error: ${err.message}`);
    }
  });

  // Leave group room
  socket.on('leave_group', ({ groupId }) => {
    socket.leave(`group:${groupId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`[Chat] ${socket.user.name} disconnected`);
  });
});

// Export io so controllers can emit system messages
module.exports.io = io;

// ── Schedulers ────────────────────────────────────────────────────────────
const { runReminderScheduler } = require('./services/contributionReminderService');
const { runSavingsAutopay }    = require('./services/savingsAutopayService');

// ── Start server ──────────────────────────────────────────────────────────
const start = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      await pool.query('SELECT 1');
      logger.info('Database connected');
    } else {
      pool.query('SELECT 1')
        .then(() => logger.info('Database connected'))
        .catch(() => logger.warn('Database unavailable — running without DB (dev mode)'));
    }
    httpServer.listen(PORT, () => {
      logger.info(`Via server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

    // Run contribution reminders every hour
    setInterval(() => {
      runReminderScheduler().catch(err => logger.error(`[Reminders] ${err.message}`));
    }, 60 * 60 * 1000);

    // Run savings autopay every hour (logic inside decides if today is the right day)
    setInterval(() => {
      runSavingsAutopay().catch(err => logger.error(`[SavingsAutopay] ${err.message}`));
    }, 60 * 60 * 1000);

    logger.info('Schedulers started (reminders + savings autopay, hourly)');
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
