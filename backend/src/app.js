const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const contentRoutes = require('./routes/contentRoutes');
const hackathonRoutes = require('./routes/hackathonRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// 1. Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Frontend'in çalıştığı adrese izin veriyoruz
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Frontend adresi
  credentials: true
}));

// 3. HTTP Request Logging (morgan)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// 4. Rate Limiting for general API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Çok fazla istek gönderildi. Lütfen 15 dakika sonra tekrar deneyiniz.'
  }
});
app.use('/api/', generalLimiter);

// 5. Stricter Rate Limiting for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 requests per 15 minutes for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Çok fazla kimlik doğrulama denemesi. Lütfen bir süre sonra tekrar deneyiniz.'
  }
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// 6. Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 7. Static File Serving for Uploaded Assets
const uploadDir = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadDir));

// 8. API Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'GDG On Campus Pamukkale University Backend API is running.',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'GDG On Campus Pamukkale University Backend API v1 is healthy.',
    timestamp: new Date().toISOString()
  });
});

// 9. API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/hackathon', hackathonRoutes);

// 10. 404 Route Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `İstenen kaynak bulunamadı: ${req.method} ${req.originalUrl}`
  });
});

// 11. Global Error Handling Middleware
app.use(errorHandler);

module.exports = app;

