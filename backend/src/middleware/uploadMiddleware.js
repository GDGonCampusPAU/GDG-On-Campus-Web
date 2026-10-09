const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const sanitizedBase = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sanitizedBase}-${uniqueSuffix}${ext}`);
  }
});

// Filter for images (Content cover images)
const imageFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|gif/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedExtensions.test(ext) && (mime.startsWith('image/') || allowedExtensions.test(mime))) {
    cb(null, true);
  } else {
    cb(new Error('Yalnızca resim dosyaları (.jpg, .jpeg, .png, .webp, .gif) yüklenebilir.'), false);
  }
};

// Filter for resumes / documents (Hackathon resumes)
const resumeFilter = (req, file, cb) => {
  const allowedExtensions = /pdf|doc|docx/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

  if (allowedExtensions.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Özgeçmiş için yalnızca PDF veya Word (.pdf, .doc, .docx) dosyaları kabul edilmektedir.'), false);
  }
};

const uploadCoverImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: imageFilter
});

const uploadResume = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: resumeFilter
});

module.exports = {
  uploadCoverImage,
  uploadResume
};

