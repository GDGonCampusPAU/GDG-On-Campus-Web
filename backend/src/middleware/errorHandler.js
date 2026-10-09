/**
 * Global Error Handling Middleware
 * Ensures consistent JSON error responses across the application
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || 'Sunucu içi bir hata oluştu.';

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Geçersiz kaynak kimliği (ID): ${err.value}`;
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = errors.join(', ');
  }

  // Handle Mongo Duplicate Key Error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || 'alan';
    message = `Girilen ${duplicatedField} zaten kullanımda. Lütfen farklı bir değer deneyiniz.`;
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Yüklenen dosya boyutu izin verilen sınırı aşıyor (Maksimum 5MB).';
    } else {
      message = `Dosya yükleme hatası: ${err.message}`;
    }
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Geçersiz JSON formatı gönderildi.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;

