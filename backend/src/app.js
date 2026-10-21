const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const contentRoutes = require('./routes/contentRoutes');
const formRoutes = require('./routes/formRoutes');
const hackathonModule = require('./modules/hackathon');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const { randomUUID } = require('node:crypto');
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isSafeInteger(proxyHops) || proxyHops < 0) throw new Error('TRUST_PROXY_HOPS negatif olmayan tam sayı olmalıdır.');
if (proxyHops) app.set('trust proxy', proxyHops);

// 1. Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Frontend'in çalıştığı adrese izin veriyoruz
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174')
  .split(',').map(value => value.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(Object.assign(new Error('Bu origin için erişim izni yok.'), { status: 403 }));
  }
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
app.use('/api/v1/auth/send-otp', authLimiter);
app.use('/api/v1/auth/verify-email', authLimiter);
app.use('/api/v1/hackathon/send-verification', authLimiter);

// 6. Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ message: 'İstek gövdesi JSON nesnesi olmalıdır.' });
  req.body ||= {};
  next();
});

// 7. Static File Serving for Uploaded Assets
const uploadDir = require('./middleware/uploadMiddleware').uploadDir;
app.use('/uploads/public', express.static(path.join(uploadDir, 'public')));
app.use('/api/v1/files', require('./routes/fileRoutes'));
// Existing private URLs are retained, but now require the same authorization.
app.use('/uploads', require('./routes/fileRoutes'));

// 8. API Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'GDG On Campus Pamukkale University Backend API is running.',
    timestamp: new Date().toISOString()
  });
});
app.get('/ready', (req, res) => {
  const ready = require('mongoose').connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ success: ready });
});

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'GDG On Campus Pamukkale University Backend API v1 is healthy.',
    timestamp: new Date().toISOString()
  });
});

// 9. API Routes
app.use('/api/v1/participant-auth', require('./modules/participantAuth/routes/participantAuthRoutes'));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', require('./routes/userRoutes'));
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/event-page', require('./routes/eventPageRoutes'));
app.use('/api/v1/forms', formRoutes);

// Hackathon Module (İzole edilmiş & gerektiğinde .env veya kod üzerinden kapatılabilir/kaldırılabilir)
if (hackathonModule.isEnabled()) {
  app.use('/api/v1/hackathon', hackathonModule.routes);
} else {
  app.use('/api/v1/hackathon', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Hackathon modülü şu anda kapalıdır.'
    });
  });
}

// 10. 404 Route Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `İstenen kaynak bulunamadı: ${req.method} ${req.originalUrl}`
  });
});

// 11. Global Error Handling Middleware
app.use(errorHandler);

module.exports = app;

