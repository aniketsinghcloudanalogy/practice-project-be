require('dotenv').config();

const app = require('./app');
const config = require('./config');

const PORT = config.port || process.env.PORT || 4000;

// --- Global process-level error handlers to prevent server crashes ---

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  // In production you may want to gracefully shutdown, but don't crash instantly
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
  // Don't crash the process — just log it
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle server-level errors (e.g., port already in use)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${PORT} is already in use. Please free the port and restart.`);
  } else {
    console.error('[FATAL] Server error:', err.message);
  }
});
