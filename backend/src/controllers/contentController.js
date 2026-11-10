const fs = require('node:fs');
const path = require('node:path');
const { literalSearch } = require('../utils/query');
const Content = require('../models/Content');
const { validateContentInput } = require('../utils/validators');

/**
 * Validates that a URL is http:, https: or a local /uploads/public/... path
 */
const isValidUrlOrPublicPath = (val) => {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/uploads/public/')) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Helper to unlink previous local public uploads on update or delete
 */
const unlinkLocalPublicImage = async (url) => {
  if (!url || typeof url !== 'string') return;
  const match = url.match(/\/uploads\/public\/([^/?#]+)/);
  if (match && match[1]) {
    const filename = path.basename(match[1]);
    if (!filename || filename === '.' || filename === '..') return;
    const uploadBase = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    const filePath = path.join(uploadBase, 'public', filename);
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Ignore missing file errors
      }
    }
  }
};

/**
 * Helper to resolve cover image URL from file upload or body
 */
const resolveCoverImageUrl = (req) => {
  if (req.file) {
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}/uploads/public/${req.file.filename}`;
  }
  return req.body.coverImageUrl || null;
};

/**
 * @desc    Get public events and announcements with pagination & filtering
 * @route   GET /api/v1/content/public
 * @access  Public
 */
const getPublicContent = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    // Filter by type (EVENT or ANNOUNCEMENT)
    if (req.query.type && typeof req.query.type === 'string' && ['EVENT', 'ANNOUNCEMENT'].includes(req.query.type.toUpperCase())) {
      filter.type = req.query.type.toUpperCase();
    }

    // Optional keyword search in title & description
    if (req.query.search && typeof req.query.search === 'string') {
      const searchRegex = literalSearch(req.query.search);
      filter.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const [items, totalItems] = await Promise.all([
      Content.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Content.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get featured events and announcements for the home slider
 * @route   GET /api/v1/content/featured
 * @access  Public
 */
const getFeaturedContent = async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));

    const featuredItems = await Content.find({ isFeatured: true })
      .sort({ eventDate: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: featuredItems.length,
      data: featuredItems
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new event or announcement
 * @route   POST /api/v1/content
 * @access  Private (ORGANIZER, ADMIN)
 */
const createContent = async (req, res, next) => {
  try {
    const { title, description, bevyLink, isFeatured, type, eventDate, category, slug } = req.body;

    // Check string types
    const stringFields = { title, description, type, category, slug, bevyLink };
    for (const [key, val] of Object.entries(stringFields)) {
      if (val !== undefined && val !== null && typeof val !== 'string') {
        return res.status(400).json({
          success: false,
          message: `${key} alanı metin (string) türünde olmalıdır.`
        });
      }
    }

    if (req.body.coverImageUrl !== undefined && req.body.coverImageUrl !== null && typeof req.body.coverImageUrl !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'coverImageUrl alanı metin (string) türünde olmalıdır.'
      });
    }

    if (bevyLink && !isValidUrlOrPublicPath(bevyLink)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz bevyLink formatı veya protokolü.'
      });
    }

    if (req.body.coverImageUrl && !isValidUrlOrPublicPath(req.body.coverImageUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz coverImageUrl formatı veya protokolü.'
      });
    }

    // Validate inputs
    const errors = validateContentInput({ title, description, type });
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(' ')
      });
    }

    const coverImageUrl = resolveCoverImageUrl(req);

    const newContent = await Content.create({
      title: title.trim(),
      description: description.trim(),
      coverImageUrl,
      bevyLink: bevyLink ? bevyLink.trim() : null,
      isFeatured: isFeatured === true || isFeatured === 'true',
      type: type.toUpperCase(),
      eventDate: eventDate ? new Date(eventDate) : null
    });

    return res.status(201).json({
      success: true,
      message: 'İçerik başarıyla oluşturuldu.',
      data: newContent
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update existing event or announcement
 * @route   PUT /api/v1/content/:id
 * @access  Private (ORGANIZER, ADMIN)
 */
const updateContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, bevyLink, isFeatured, type, eventDate, category, slug } = req.body;

    const stringFields = { title, description, type, category, slug, bevyLink };
    for (const [key, val] of Object.entries(stringFields)) {
      if (val !== undefined && val !== null && typeof val !== 'string') {
        return res.status(400).json({
          success: false,
          message: `${key} alanı metin (string) türünde olmalıdır.`
        });
      }
    }

    if (req.body.coverImageUrl !== undefined && req.body.coverImageUrl !== null && typeof req.body.coverImageUrl !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'coverImageUrl alanı metin (string) türünde olmalıdır.'
      });
    }

    if (bevyLink && !isValidUrlOrPublicPath(bevyLink)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz bevyLink formatı veya protokolü.'
      });
    }

    if (req.body.coverImageUrl && !isValidUrlOrPublicPath(req.body.coverImageUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz coverImageUrl formatı veya protokolü.'
      });
    }

    const content = await Content.findById(id);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Güncellenecek içerik bulunamadı.'
      });
    }

    // Validate updates if provided
    const errors = validateContentInput({ title, description, type }, true);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(' ')
      });
    }

    if (title !== undefined) content.title = title.trim();
    if (description !== undefined) content.description = description.trim();
    if (bevyLink !== undefined) content.bevyLink = bevyLink ? bevyLink.trim() : null;
    if (isFeatured !== undefined) content.isFeatured = isFeatured === true || isFeatured === 'true';
    if (type !== undefined) content.type = type.toUpperCase();
    if (eventDate !== undefined) content.eventDate = eventDate ? new Date(eventDate) : null;

    const previousCoverImageUrl = content.coverImageUrl;
    let coverImageChanged = false;

    // If new cover image uploaded or provided
    if (req.file) {
      content.coverImageUrl = resolveCoverImageUrl(req);
      coverImageChanged = true;
    } else if (req.body.coverImageUrl !== undefined) {
      if (req.body.coverImageUrl !== previousCoverImageUrl) {
        content.coverImageUrl = req.body.coverImageUrl || null;
        coverImageChanged = true;
      }
    }

    await content.save();

    if (coverImageChanged && previousCoverImageUrl && previousCoverImageUrl !== content.coverImageUrl) {
      await unlinkLocalPublicImage(previousCoverImageUrl);
    }

    return res.status(200).json({
      success: true,
      message: 'İçerik başarıyla güncellendi.',
      data: content
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete event or announcement
 * @route   DELETE /api/v1/content/:id
 * @access  Private (ORGANIZER, ADMIN)
 */
const deleteContent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await Content.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Silinecek içerik bulunamadı.'
      });
    }

    if (deleted.coverImageUrl) {
      await unlinkLocalPublicImage(deleted.coverImageUrl);
    }

    return res.status(200).json({
      success: true,
      message: 'İçerik başarıyla silindi.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicContent,
  getFeaturedContent,
  createContent,
  updateContent,
  deleteContent
};

