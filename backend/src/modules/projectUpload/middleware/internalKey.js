// Guards the internal API that only the project upload site's backend calls.
// The caller sends PROJECT_UPLOAD_INTERNAL_KEY in the X-Internal-Key header. Without a configured
// key (≥ 32 characters) the routes answer 404, as if they did not exist. nginx also refuses these
// paths to anything that did not come from the private Docker network (nginx/nginx.conf).
const crypto = require('crypto');

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();

module.exports = (req, res, next) => {
  const key = process.env.PROJECT_UPLOAD_INTERNAL_KEY || '';
  if (key.length < 32) return res.status(404).json({ success: false, message: 'Bulunamadı.' });
  const sent = req.get('x-internal-key') || '';
  // Hashing first gives equal-length buffers, so the comparison takes the same time for any input.
  if (!crypto.timingSafeEqual(digest(sent), digest(key))) {
    return res.status(401).json({ success: false, message: 'Yetkisiz.', code: 'BAD_INTERNAL_KEY' });
  }
  return next();
};
