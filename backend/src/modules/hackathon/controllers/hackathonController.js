const { escapeCsvCell, literalSearch } = require('../../../utils/query');
const HackathonApp = require('../models/HackathonApp');
const VerificationToken = require('../../../models/VerificationToken');
const { validateHackathonInput, isValidEmail } = require('../../../utils/validators');
const { sendTeamOtp } = require('../../../services/teamOtpService');

/**
 * Helper to resolve resume URL from file upload or body
 */
const resolveResumeUrl = (req) => {
  if (req.file) {
    return `/api/v1/files/${req.file.filename}`;
  }
  return req.body.resumeUrl || null;
};

/**
 * Helper to escape CSV cell value
 */


/**
 * @desc    Send verification code to hackathon team leader email
 * @route   POST /api/v1/hackathon/send-verification
 * @access  Public
 */
const sendHackathonVerification = async (req, res, next) => {
  try {
    const { leaderEmail, leaderName, teamName } = req.body;

    if (!leaderEmail || !isValidEmail(leaderEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Lütfen geçerli bir e-posta adresi giriniz.'
      });
    }

    const normalizedEmail = leaderEmail.toLowerCase().trim();

    // Generate 6-digit OTP code (10 min TTL)
    await sendTeamOtp({
      email: normalizedEmail, purpose: 'HACKATHON_APPLY',
      leaderName: leaderName ? leaderName.trim() : 'Takım Lideri',
      teamName: teamName ? teamName.trim() : ''
      });

    return res.status(200).json({
      success: true,
      message: 'Doğrulama kodu takım lideri e-posta adresine gönderildi. Lütfen gelen kutunuzu kontrol ediniz.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit hackathon application form (requires valid verificationCode)
 * @route   POST /api/v1/hackathon/apply
 * @access  Public
 */
const applyHackathon = async (req, res, next) => {
  try {
    const {
      teamName,
      leaderName,
      leaderEmail,
      leaderPhone,
      memberCount,
      projectIdea,
      verificationCode,
      code
    } = req.body;

    const inputCode = verificationCode || code;

    // 1. Validate Form Fields
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

    const normalizedEmail = leaderEmail.trim().toLowerCase();

    // 2. Validate Verification Code
    if (!inputCode) {
      // If code was not entered, auto-send code and prompt user to enter it
      await sendTeamOtp({
        email: normalizedEmail, purpose: 'HACKATHON_APPLY',
        leaderName: leaderName.trim(),
        teamName: teamName.trim()
      });

      return res.status(400).json({
        success: false,
        requiresVerification: true,
        message: 'Başvuruyu tamamlamak için takım lideri e-postasına gönderilen 6 haneli doğrulama kodunu giriniz.'
      });
    }

    // Verify OTP
    const verification = await VerificationToken.verifyOtp(normalizedEmail, inputCode, 'HACKATHON_APPLY');
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // 3. Process Resume / Attachment
    const resumeUrl = resolveResumeUrl(req);

    // 4. Save Hackathon Application
    const application = await HackathonApp.create({
      teamName: teamName.trim(),
      leaderName: leaderName.trim(),
      leaderEmail: normalizedEmail,
      leaderPhone: leaderPhone.trim(),
      memberCount: Number(memberCount),
      projectIdea: projectIdea.trim(),
      resumeUrl
    });

    return res.status(201).json({
      success: true,
      message: 'E-posta adresiniz doğrulandı ve Hackathon başvurunuz başarıyla alındı! Ekibinizle iletişime geçilecektir.',
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

    if (req.query.search && typeof req.query.search === 'string') {
      const searchRegex = literalSearch(req.query.search);
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
  sendHackathonVerification,
  applyHackathon,
  getApplications,
  exportApplications
};
