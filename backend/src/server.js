require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Start server after connecting to database
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log('====================================================');
      console.log(` GDG On Campus Pamukkale University Backend API`);
      console.log(` Server running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(` Listening on port: ${PORT}`);
      console.log(` Base API URL: http://localhost:${PORT}/api/v1`);
      console.log('====================================================');
    });

    // Graceful Shutdown on termination signals
    const shutdown = (signal) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle Unhandled Promise Rejections
    process.on('unhandledRejection', (err) => {
      console.error('[Server Error] Unhandled Rejection:', err);
      server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error('[Server Error] Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

