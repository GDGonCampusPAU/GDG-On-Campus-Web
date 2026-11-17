const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ensureAdmin = async () => {
  const email = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@pau.edu.tr').trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'ADMIN') throw new Error('Seed adresi başka bir role ait; otomatik yetki yükseltme yapılmadı.');
    if (!existing.isEmailVerified) { existing.isEmailVerified = true; await existing.save(); }
    return existing;
  }
  const password = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!password || password.length < 12 || password === 'Admin123456!') {
    throw new Error('Yeni admin için DEFAULT_ADMIN_PASSWORD en az 12 karakterlik özel bir parola olmalıdır.');
  }
  return User.create({ email, fullName: process.env.DEFAULT_ADMIN_NAME || 'GDG PAU Admin',
    passwordHash: await bcrypt.hash(password, 12), role: 'ADMIN', isEmailVerified: true });
};
module.exports = { ensureAdmin };
