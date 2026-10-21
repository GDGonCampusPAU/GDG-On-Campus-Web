const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
for (const kind of ['public', 'private']) fs.mkdirSync(path.join(uploadDir, kind), { recursive: true });
const removeFiles = async (files) => Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
const failure = message => Object.assign(new Error(message), { status: 400 });
const signatureMatches = (ext, bytes) => {
  const hex = bytes.subarray(0, 12).toString('hex');
  if (ext === '.pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (['.docx', '.zip'].includes(ext)) return hex.startsWith('504b0304');
  if (ext === '.doc') return hex.startsWith('d0cf11e0a1b11ae1');
  if (ext === '.png') return hex.startsWith('89504e470d0a1a0a');
  if (['.jpg', '.jpeg'].includes(ext)) return hex.startsWith('ffd8ff');
  if (ext === '.gif') return /^GIF8[79]a/.test(bytes.toString());
  if (ext === '.webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (ext === '.rar') return hex.startsWith('526172211a07');
  if (ext === '.txt') return !bytes.includes(0);
  return false;
};
const makeUpload = (visibility, extensions, fileSize) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => callback(null, path.join(uploadDir, visibility)),
      filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize, files: 5, fields: 100, parts: 105 },
    fileFilter: (_req, file, callback) => {
      if (extensions.includes(path.extname(file.originalname).toLowerCase())) callback(null, true);
      else callback(failure('Yüklenen dosya türü desteklenmiyor.'));
    }
  });
  const validate = middleware => (req, res, next) => middleware(req, res, async error => {
    const files = req.file ? [req.file] : (req.files || []);
    try {
      if (error) throw error;
      if (files.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024) throw failure('Toplam dosya boyutu 25 MB sınırını aşıyor.');
      for (const file of files) {
        const handle = await fs.promises.open(file.path, 'r');
        const bytes = Buffer.alloc(Math.min(file.size, 8192));
        try { await handle.read(bytes, 0, bytes.length, 0); } finally { await handle.close(); }
        if (!signatureMatches(path.extname(file.filename), bytes)) throw failure('Dosya içeriği uzantısıyla eşleşmiyor.');
      }
      res.once('finish', () => { if (res.statusCode >= 400) void removeFiles(files); });
      next();
    } catch (error) { await removeFiles(files); next(error); }
  });
  return { single: name => validate(upload.single(name)), any: () => validate(upload.any()) };
};
module.exports = {
  uploadDir,
  removeFiles,
  uploadCoverImage: makeUpload('public', ['.jpeg', '.jpg', '.png', '.webp', '.gif'], 5 * 1024 * 1024),
  uploadResume: makeUpload('private', ['.pdf', '.doc', '.docx'], 10 * 1024 * 1024),
  uploadFormFiles: makeUpload('private', ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx', '.zip', '.rar', '.txt'], 15 * 1024 * 1024)
};
