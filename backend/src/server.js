require('dotenv').config();
const app = require('./app');
const { pool } = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

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
    app.listen(PORT, () => {
      logger.info(`Via server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
