const HackathonApp = require('../models/HackathonApp');
const { validateHackathonInput } = require('../utils/validators');

/**
 * Helper to resolve resume URL from file upload or body
 */
const resolveResumeUrl = (req) => {
  if (req.file) {
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}/uploads/${req.file.filename}`;
  }
  return req.body.resumeUrl || null;
};

/**
 * @desc    Submit hackathon application form
 * @route   POST /api/v1/hackathon/apply
 * @access  Public
 */
const applyHackathon = async (req, res, next) => {
  try {
    const { teamName, leaderName, leaderEmail, leaderPhone, memberCount, projectIdea } = req.body;

    // Validate inputs
    const errors = validateHackathonInput({
      teamName,
      leaderName,
      leaderEmail,
      leaderPhone,
      memberCount,
      projectIdea
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(' ')
      });
    }

    const resumeUrl = resolveResumeUrl(req);

    const application = await HackathonApp.create({
      teamName: teamName.trim(),
      leaderName: leaderName.trim(),
      leaderEmail: leaderEmail.trim().toLowerCase(),
      leaderPhone: leaderPhone.trim(),
      memberCount: Number(memberCount),
      projectIdea: projectIdea.trim(),
      resumeUrl
    });

    return res.status(201).json({
      success: true,
      message: 'Hackathon başvurunuz başarıyla alındı! Ekibinizle iletişime geçilecektir.',
      data: {
        applicationId: application._id,
        teamName: application.teamName,
        leaderName: application.leaderName,
        appliedAt: application.appliedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all submitted applications for Core Team
 * @route   GET /api/v1/hackathon/applications
 * @access  Private (ORGANIZER, ADMIN)
 */
const getApplications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    // Search by teamName, leaderName, or leaderEmail
    if (req.query.search && typeof req.query.search === 'string') {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [
        { teamName: searchRegex },
        { leaderName: searchRegex },
        { leaderEmail: searchRegex }
      ];
    }

    const [applications, totalItems] = await Promise.all([
      HackathonApp.find(filter)
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HackathonApp.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      data: applications,
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
 * Helper to escape CSV cell value
 */
const escapeCsvCell = (val) => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * @desc    Export applications as CSV or JSON
 * @route   GET /api/v1/hackathon/applications/export
 * @access  Private (ORGANIZER, ADMIN)
 */
const exportApplications = async (req, res, next) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();

    const applications = await HackathonApp.find()
      .sort({ appliedAt: -1 })
      .lean();

    if (format === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename="hackathon_applications.json"');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify(applications, null, 2));
    }

    // Default: CSV export
    const headers = [
      'ID',
      'Takım Adı',
      'Lider Adı',
      'Lider E-posta',
      'Lider Telefon',
      'Üye Sayısı',
      'Proje Fikri',
      'Özgeçmiş / CV Linki',
      'Başvuru Tarihi'
    ];

    const rows = applications.map((app) => [
      escapeCsvCell(app._id),
      escapeCsvCell(app.teamName),
      escapeCsvCell(app.leaderName),
      escapeCsvCell(app.leaderEmail),
      escapeCsvCell(app.leaderPhone),
      escapeCsvCell(app.memberCount),
      escapeCsvCell(app.projectIdea),
      escapeCsvCell(app.resumeUrl || ''),
      escapeCsvCell(new Date(app.appliedAt).toISOString())
    ]);

    // Include UTF-8 BOM so Microsoft Excel correctly displays Turkish characters
    const csvContent =
      '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hackathon_applications.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyHackathon,
  getApplications,
  exportApplications
};

