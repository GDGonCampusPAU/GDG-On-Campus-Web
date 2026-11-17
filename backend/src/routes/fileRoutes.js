const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');
const auth = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { uploadDir } = require('../middleware/uploadMiddleware');
const router = express.Router();
router.use(auth, requireRoles('ORGANIZER', 'ADMIN'));
router.get('/:filename', async (req, res, next) => {
  try {
    const name = req.params.filename;
    if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.startsWith('.')) return res.status(400).json({ message: 'Geçersiz dosya adı.' });
    let file = path.join(uploadDir, 'private', name);
    try { await fs.access(file); }
    catch { file = path.join(uploadDir, name); await fs.access(file); }
    res.setHeader('Cache-Control', 'private, no-store');
    res.download(file, name, error => { if (error) next(error); });
  } catch (error) { if (error.code === 'ENOENT') return res.status(404).json({ message: 'Dosya bulunamadı.' }); next(error); }
});
module.exports = router;
