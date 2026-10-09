const Content = require('../models/Content');
const { validateContentInput } = require('../utils/validators');

/**
 * Helper to resolve cover image URL from file upload or body
 */
const resolveCoverImageUrl = (req) => {
  if (req.file) {
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}/uploads/${req.file.filename}`;
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
    if (req.query.type && ['EVENT', 'ANNOUNCEMENT'].includes(req.query.type.toUpperCase())) {
      filter.type = req.query.type.toUpperCase();
    }

    // Optional keyword search in title & description
    if (req.query.search && typeof req.query.search === 'string') {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
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
    const { title, description, bevyLink, isFeatured, type, eventDate } = req.body;

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
    const { title, description, bevyLink, isFeatured, type, eventDate } = req.body;

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

    // If new cover image uploaded or provided
    if (req.file) {
      content.coverImageUrl = resolveCoverImageUrl(req);
    } else if (req.body.coverImageUrl !== undefined) {
      content.coverImageUrl = req.body.coverImageUrl;
    }

    await content.save();

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

