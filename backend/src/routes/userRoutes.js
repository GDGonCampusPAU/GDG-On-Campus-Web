const express = require('express');
const User = require('../models/User');
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const router = express.Router();
router.use(auth, requireRoles('ADMIN'));
router.get('/', async (req, res, next) => {
  try {
    const roles = User.schema.path('role').enumValues;
    if (req.query.role && !roles.includes(req.query.role)) return res.status(400).json({ message: 'Geçersiz rol.' });
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 50;
    const filter = req.query.role ? { role: req.query.role } : {};
    const [data, totalItems] = await Promise.all([
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    res.json({ success: true, data, pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit) || 1 } });
  } catch (error) { next(error); }
});
router.patch('/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!User.schema.path('role').enumValues.includes(role)) return res.status(400).json({ message: 'Geçersiz rol.' });
    if (String(req.user._id) === req.params.id) return res.status(400).json({ message: 'Kendi rolünüzü değiştiremezsiniz.' });
    let user;
    await mongoose.connection.transaction(async session => {
      // Writing actor and target serializes concurrent cross-demotions.
      const actor = await User.updateOne({ _id: req.user._id, role: 'ADMIN' }, { $inc: { roleChangeVersion: 1 } }, { session });
      if (!actor.matchedCount) throw Object.assign(new Error('Yönetim yetkisi artık geçerli değil.'), { status: 403 });
      user = await User.findById(req.params.id).session(session);
      if (!user) throw Object.assign(new Error('Kullanıcı bulunamadı.'), { status: 404 });
      if (!user.isEmailVerified && role !== 'PENDING') throw Object.assign(new Error('Önce e-posta doğrulanmalıdır.'), { status: 400 });
      user.role = role;
      await user.save({ session });
    });
    res.json({ success: true, user });
  } catch (error) { next(error); }
});
module.exports = router;
