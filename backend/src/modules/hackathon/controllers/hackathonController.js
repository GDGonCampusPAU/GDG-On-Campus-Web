const { escapeCsvCell, literalSearch } = require('../../../utils/query');
const HackathonApp = require('../models/HackathonApp');
const {
  APPLICATION_STATUSES,
  buildStatusFilter,
  combineFilters,
  updateApplicationDecision
} = require('../../../services/applicationStatusService');

// The public legacy endpoints (send-verification, apply) were removed: registration runs through
// /api/v1/forms (participant verification + admin "Kayıtlar" permission). Staff keep read access
// to applications collected before that.

/**
 * @desc    Get all submitted applications for Core Team
 * @route   GET /api/v1/hackathon/applications
 * @access  Private (ORGANIZER, ADMIN)
 */
const getApplications = async (req, res, next) => {
  try {
    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    if (rawStatus && !APPLICATION_STATUSES.includes(rawStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz başvuru durumu filtresi (PENDING, APPROVED, REJECTED olmalıdır).'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    let searchClause = null;
    if (req.query.search && typeof req.query.search === 'string') {
      const searchRegex = literalSearch(req.query.search);
      searchClause = {
        $or: [
          { teamName: searchRegex },
          { leaderName: searchRegex },
          { leaderEmail: searchRegex }
        ]
      };
    }

    const filter = combineFilters(buildStatusFilter(rawStatus), searchClause);

    const [applications, totalItems] = await Promise.all([
      HackathonApp.find(filter)
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HackathonApp.countDocuments(filter)
    ]);

    const normalizedApplications = applications.map((application) => ({
      ...application,
      status: application.status || 'PENDING'
    }));

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      data: normalizedApplications,
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
 * @desc    Update legacy hackathon application status and notify team leader
 * @route   PATCH /api/v1/hackathon/applications/:id/status
 * @access  Private (ORGANIZER, ADMIN)
 */
const updateApplicationStatus = async (req, res, next) => {
  try {
    const application = await HackathonApp.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon başvurusu bulunamadı.'
      });
    }

    const { application: updated, emailSent } = await updateApplicationDecision({
      doc: application,
      reviewerId: req.user?._id,
      status: req.body.status,
      note: req.body.note,
      notify: req.body.notify,
      recipientEmail: application.leaderEmail,
      recipientName: application.leaderName || application.fullName || application.teamName || 'Takım Lideri',
      teamName: application.teamName || '',
      eventTitle: 'PAU Hackathon 2026'
    });

    const statusLabel = updated.status === 'APPROVED'
      ? 'onaylandı'
      : updated.status === 'REJECTED'
        ? 'reddedildi'
        : 'beklemeye alındı';

    return res.status(200).json({
      success: true,
      emailSent,
      message: emailSent
        ? `Başvuru ${statusLabel} ve takım liderine bilgilendirme e-postası gönderildi.`
        : `Başvuru durumu güncellendi (${statusLabel}).`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export applications as CSV or JSON
 * @route   GET /api/v1/hackathon/applications/export
 * @access  Private (ORGANIZER, ADMIN)
 */
const exportApplications = async (req, res, next) => {
  try {
    const { write, streamJson } = require('../../../utils/streamExport');
    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    if (rawStatus && !APPLICATION_STATUSES.includes(rawStatus)) {
      return res.status(400).json({ message: 'Geçersiz başvuru durumu filtresi (PENDING, APPROVED, REJECTED olmalıdır).' });
    }
    const format = req.query.format || 'csv';
    if (!['csv', 'json'].includes(format)) return res.status(400).json({ message: 'Desteklenen formatlar: csv, json.' });
    let searchClause = null;
    if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
      const searchRegex = literalSearch(req.query.search);
      searchClause = {
        $or: [
          { teamName: searchRegex },
          { leaderName: searchRegex },
          { leaderEmail: searchRegex }
        ]
      };
    }
    const filter = combineFilters(buildStatusFilter(rawStatus), searchClause);
    const cursor = HackathonApp.find(filter).sort({ appliedAt: -1 }).lean().cursor();
    res.setHeader('Content-Disposition', `attachment; filename="hackathon_applications.${format}"`);
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return await streamJson(res, cursor);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    try {
      await write(res, '\uFEFF' + ['ID', 'Takım Adı', 'Lider Adı', 'Lider E-posta', 'Lider Telefon', 'Üye Sayısı', 'Proje Fikri', 'Özgeçmiş / CV Linki', 'Başvuru Tarihi', 'Durum', 'Değerlendirme Notu'].map(escapeCsvCell).join(',') + '\r\n');
      for await (const application of cursor) {
        await write(res, [application._id, application.teamName, application.leaderName || application.fullName,
          application.leaderEmail, application.leaderPhone, application.memberCount, application.projectIdea || application.motivation,
          application.resumeUrl, new Date(application.appliedAt).toISOString(), application.status || 'PENDING', application.statusNote || ''].map(escapeCsvCell).join(',') + '\r\n');
      }
    } finally { await cursor.close(); }
    res.end();
  } catch (error) { next(error); }
};

module.exports = {
  getApplications,
  updateApplicationStatus,
  exportApplications
};
