const mongoose = require('mongoose');
const { answerError } = require('../utils/formValidation');
const { escapeCsvCell, literalSearch } = require('../utils/query');
const { saveSubmission } = require('../services/formSubmissionService');
const { lookupTeam } = require('../services/teamService');
const HackathonTeam = require('../models/HackathonTeam');
const teamAdmin = require('../services/teamAdminService');

// Team filter for staff lists: solo | team (approved in a team) | captain | pending (waiting for a captain).
const TEAM_FILTERS = {
  solo: { team: null },
  team: { team: { $ne: null }, teamStatus: { $ne: 'PENDING' } },
  captain: { teamRole: 'CAPTAIN' },
  pending: { teamStatus: 'PENDING' }
};
const teamFilterOf = (value) => (typeof value === 'string' && TEAM_FILTERS[value]) || null;
const teamRoleLabel = (response) => !response.team ? 'Bireysel'
  : response.teamRole === 'CAPTAIN' ? 'Kaptan' : response.teamStatus === 'PENDING' ? 'Kaptan onayı bekliyor' : 'Üye';
const {
  APPLICATION_STATUSES,
  buildStatusFilter,
  combineFilters,
  resolveFormApplicant,
  updateApplicationDecision
} = require('../services/applicationStatusService');
const { unlink } = require('node:fs/promises');
const EventPage = require('../models/EventPage');
const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');

/**
 * Utility to generate a URL-safe slug
 */
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

/**
 * Helper to escape CSV values
 */


// =========================================================================
// ORGANIZER / ADMIN CONTROLLERS
// =========================================================================

/**
 * @desc    Create a new dynamic form
 * @route   POST /api/v1/forms
 * @access  Private (ORGANIZER, ADMIN)
 */
const createForm = async (req, res, next) => {
  try {
    const {
      title,
      description,
      slug,
      status,
      category,
      bannerImageUrl,
      startDate,
      endDate,
      maxSubmissions,
      fields,
      settings
    } = req.body;

    const stringFields = { title, description, slug, status, category, bannerImageUrl };
    for (const [key, val] of Object.entries(stringFields)) {
      if (val !== undefined && val !== null && typeof val !== 'string') {
        return res.status(400).json({
          success: false,
          message: `${key} alanı metin (string) türünde olmalıdır.`
        });
      }
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Form başlığı zorunludur.'
      });
    }

    // Determine or generate unique slug
    let baseSlug = slug ? generateSlug(slug) : generateSlug(title);
    if (!baseSlug) baseSlug = `form-${Date.now()}`;

    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await Form.exists({ slug: uniqueSlug })) {
      uniqueSlug = `${baseSlug}-${counter++}`;
    }

    // Format fields with unique fieldIds and order
    const formattedFields = (Array.isArray(fields) ? fields : []).map((f, index) => ({
      fieldId: f.fieldId || `field_${index + 1}_${Date.now().toString(36)}`,
      label: f.label || `Soru ${index + 1}`,
      description: f.description || '',
      type: f.type || 'text',
      required: !!f.required,
      placeholder: f.placeholder || '',
      options: Array.isArray(f.options) ? f.options : [],
      validation: f.validation || {},
      order: f.order !== undefined ? f.order : index
    }));

    const newForm = await Form.create({
      title: title.trim(),
      description: description ? description.trim() : '',
      slug: uniqueSlug,
      status: status || 'DRAFT',
      category: category ? category.trim().toUpperCase() : 'GENERAL',
      bannerImageUrl: bannerImageUrl || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      maxSubmissions: maxSubmissions ? Number(maxSubmissions) : null,
      fields: formattedFields,
      settings: settings || {},
      createdBy: req.user ? req.user._id : null
    });

    return res.status(201).json({
      success: true,
      message: 'Form başarıyla oluşturuldu.',
      data: newForm
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all forms (with filters & pagination)
 * @route   GET /api/v1/forms
 * @access  Private (ORGANIZER, ADMIN)
 */
const getAllForms = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status && typeof req.query.status === 'string') {
      filter.status = req.query.status.toUpperCase();
    }

    if (req.query.category && typeof req.query.category === 'string') {
      filter.category = req.query.category.toUpperCase();
    }

    if (req.query.search) {
      const searchRegex = literalSearch(req.query.search);
      filter.$or = [{ title: searchRegex }, { description: searchRegex }, { slug: searchRegex }];
    }

    const [forms, totalItems] = await Promise.all([
      Form.find(filter)
        .populate('createdBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Form.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      data: forms,
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
 * @desc    Get single form configuration by ID
 * @route   GET /api/v1/forms/:id
 * @access  Private (ORGANIZER, ADMIN)
 */
const getFormById = async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id).populate('createdBy', 'fullName email');
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form bulunamadı.'
      });
    }

    return res.status(200).json({
      success: true,
      data: form
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update form configuration & questions
 * @route   PUT /api/v1/forms/:id
 * @access  Private (ORGANIZER, ADMIN)
 */
const updateForm = async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Güncellenecek form bulunamadı.'
      });
    }

    const {
      title,
      description,
      slug,
      status,
      category,
      bannerImageUrl,
      startDate,
      endDate,
      maxSubmissions,
      fields,
      settings
    } = req.body;

    const stringFields = { title, description, slug, status, category, bannerImageUrl };
    for (const [key, val] of Object.entries(stringFields)) {
      if (val !== undefined && val !== null && typeof val !== 'string') {
        return res.status(400).json({
          success: false,
          message: `${key} alanı metin (string) türünde olmalıdır.`
        });
      }
    }

    if (title !== undefined) {
      if (title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Form başlığı boş bırakılamaz.'
        });
      }
      form.title = title.trim();
    }
    if (description !== undefined) form.description = description ? description.trim() : '';
    if (status !== undefined) form.status = status;
    if (category !== undefined) form.category = category ? category.trim().toUpperCase() : 'GENERAL';
    if (bannerImageUrl !== undefined) form.bannerImageUrl = bannerImageUrl;
    if (startDate !== undefined) form.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) form.endDate = endDate ? new Date(endDate) : null;
    if (maxSubmissions !== undefined) form.maxSubmissions = maxSubmissions ? Number(maxSubmissions) : null;
    if (settings !== undefined) form.set('settings', { ...form.toObject().settings, ...settings });

    // Update slug if explicitly passed and different
    if (slug && slug !== form.slug) {
      const newSlug = generateSlug(slug);
      const slugExists = await Form.findOne({ slug: newSlug, _id: { $ne: form._id } });
      if (slugExists) {
        return res.status(409).json({
          success: false,
          message: 'Bu URL adresi (slug) başka bir form tarafından kullanılmaktadır.'
        });
      }
      form.slug = newSlug;
    }

    // Update questions/fields
    if (Array.isArray(fields)) {
      form.set('fields', fields.map((f, index) => ({
        fieldId: f.fieldId || `field_${index + 1}_${Date.now().toString(36)}`,
        label: f.label || `Soru ${index + 1}`,
        description: f.description || '',
        type: f.type || 'text',
        required: !!f.required,
        placeholder: f.placeholder || '',
        options: Array.isArray(f.options) ? f.options : [],
        validation: f.validation || {},
        order: f.order !== undefined ? f.order : index
      })));
    }

    await form.save();

    return res.status(200).json({
      success: true,
      message: 'Form başarıyla güncellendi.',
      data: form
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Quickly toggle or update form status
 * @route   PATCH /api/v1/forms/:id/status
 * @access  Private (ORGANIZER, ADMIN)
 */
const updateFormStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz form durumu (DRAFT, PUBLISHED, CLOSED, ARCHIVED olmalıdır).'
      });
    }

    const form = await Form.findById(req.params.id);
    if (form) { form.status = status; await form.save(); }
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form bulunamadı.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Form durumu '${status}' olarak güncellendi.`,
      data: form
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a form and optionally its responses
 * @route   DELETE /api/v1/forms/:id
 * @access  Private (ORGANIZER, ADMIN)
 */
const deleteForm = async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Silinecek form bulunamadı.'
      });
    }

    if (form.eventKey && await require('../models/EventPage').exists({ formSlug: form.slug })) return res.status(409).json({ message: 'Yayınlanan etkinliğin formunu silmek yerine kapatın.' });
    let files = [];
    await mongoose.connection.transaction(async session => {
      // Write the form first, matching the serialization point used by submit.
      await Form.findByIdAndDelete(form._id, { session });
      files = await FormResponse.find({ form: form._id }).select('uploadedFiles').session(session).lean();
      await FormResponse.deleteMany({ form: form._id }).session(session);
    });
    const { uploadDir } = require('../middleware/uploadMiddleware');
    const path = require('node:path');
    await Promise.all(files.flatMap(response => response.uploadedFiles).map(file => unlink(path.join(uploadDir, 'private', path.basename(file.filename))).catch(() => {})));

    return res.status(200).json({
      success: true,
      message: 'Form ve tüm ilgili yanıtları başarıyla silindi.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get responses for a specific form
 * @route   GET /api/v1/forms/:id/responses
 * @access  Private (ORGANIZER, ADMIN)
 */
const getFormResponses = async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form bulunamadı.'
      });
    }

    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    if (rawStatus && !APPLICATION_STATUSES.includes(rawStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz başvuru durumu filtresi (PENDING, APPROVED, REJECTED olmalıdır).'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const searchClause = (typeof req.query.search === 'string' && req.query.search.trim())
      ? { $or: [{ verifiedEmail: literalSearch(req.query.search) }, { 'answers.value': literalSearch(req.query.search) }] }
      : null;
    if (req.query.team && !teamFilterOf(req.query.team)) return res.status(400).json({ success: false, message: 'Geçersiz takım filtresi (solo, team, captain, pending).' });
    const filter = combineFilters({ form: form._id }, buildStatusFilter(rawStatus), searchClause, teamFilterOf(req.query.team));

    const [responses, totalItems] = await Promise.all([
      FormResponse.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FormResponse.countDocuments(filter)
    ]);

    const teamIds = [...new Set(responses.map(response => response.team).filter(Boolean).map(String))];
    const [teams, statusCounts] = await Promise.all([
      HackathonTeam.find({ _id: { $in: teamIds } }).select('code').lean(),
      FormResponse.aggregate([{ $match: { form: form._id } }, { $group: { _id: { $ifNull: ['$status', 'PENDING'] }, count: { $sum: 1 } } }])
    ]);
    const codes = new Map(teams.map(team => [String(team._id), team.code]));
    const counts = Object.fromEntries(statusCounts.map(item => [item._id, item.count]));
    const normalizedResponses = responses.map((response) => ({
      ...response,
      status: response.status || 'PENDING',
      teamCode: response.team ? codes.get(String(response.team)) || null : null
    }));

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      form: {
        id: form._id,
        title: form.title,
        slug: form.slug,
        fields: form.fields
      },
      data: normalizedResponses,
      // Whole-form counts (filters ignored) for the summary boxes.
      summary: { total: Object.values(counts).reduce((a, b) => a + b, 0), PENDING: counts.PENDING || 0, APPROVED: counts.APPROVED || 0, REJECTED: counts.REJECTED || 0 },
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
 * @desc    Update application status on a form response and notify applicant
 * @route   PATCH /api/v1/forms/:id/responses/:responseId/status
 * @access  Private (ORGANIZER, ADMIN)
 */
const updateFormResponseStatus = async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form bulunamadı.'
      });
    }

    const response = await FormResponse.findOne({ _id: req.params.responseId, form: form._id });
    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Başvuru yanıtı bulunamadı.'
      });
    }

    let eventTitle = form.title || 'GDG On Campus PAU';
    if (form.eventKey) {
      const eventPage = await EventPage.findById(form.eventKey).select('event.name').lean();
      eventTitle = eventPage?.event?.name || 'PAU Hackathon 2026';
    }

    const { email, recipientName, teamName } = resolveFormApplicant(response);
    const { application, emailSent } = await updateApplicationDecision({
      doc: response,
      reviewerId: req.user?._id,
      status: req.body.status,
      note: req.body.note,
      notify: req.body.notify,
      recipientEmail: email,
      recipientName,
      teamName,
      eventTitle
    });

    const statusLabel = application.status === 'APPROVED'
      ? 'onaylandı'
      : application.status === 'REJECTED'
        ? 'reddedildi'
        : 'beklemeye alındı';

    // A rejected applicant leaves their team (captaincy passes on or the team dissolves).
    const teamOutcome = application.status === 'REJECTED' ? await teamAdmin.handleRejection(form, response) : null;
    const teamNote = { left: ' Takımından çıkarıldı.', 'captain-replaced': ' Takımından çıkarıldı; kaptanlık başka bir üyeye geçti.', disbanded: ' Takımının başka onaylı üyesi olmadığı için takım dağıtıldı.' }[teamOutcome] || '';
    const fresh = teamOutcome ? await FormResponse.findById(response._id).lean() : application;

    return res.status(200).json({
      success: true,
      emailSent,
      teamOutcome,
      message: (emailSent
        ? `Başvuru ${statusLabel} ve katılımcıya bilgilendirme e-postası gönderildi.`
        : `Başvuru durumu güncellendi (${statusLabel}).`) + teamNote,
      data: fresh
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export form responses as CSV or JSON
 * @route   GET /api/v1/forms/:id/responses/export
 * @access  Private (ORGANIZER, ADMIN)
 */
const exportFormResponses = async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form bulunamadı.' });
    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    if (rawStatus && !APPLICATION_STATUSES.includes(rawStatus)) {
      return res.status(400).json({ message: 'Geçersiz başvuru durumu filtresi (PENDING, APPROVED, REJECTED olmalıdır).' });
    }
    const { write, streamJson } = require('../utils/streamExport');
    const searchClause = (typeof req.query.search === 'string' && req.query.search.trim())
      ? { $or: [{ verifiedEmail: literalSearch(req.query.search) }, { 'answers.value': literalSearch(req.query.search) }] }
      : null;
    if (req.query.team && !teamFilterOf(req.query.team)) return res.status(400).json({ success: false, message: 'Geçersiz takım filtresi (solo, team, captain, pending).' });
    const filter = combineFilters({ form: form._id }, buildStatusFilter(rawStatus), searchClause, teamFilterOf(req.query.team));
    const format = req.query.format || 'csv';
    if (!['csv', 'json'].includes(format)) return res.status(400).json({ message: 'Desteklenen formatlar: csv, json.' });
    res.setHeader('Content-Disposition', `attachment; filename="${form.slug}-responses.${format}"`);
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return await streamJson(res, FormResponse.find(filter).sort({ submittedAt: -1 }).lean().cursor());
    }
    // First pass reads only question identities. Deleted/renamed questions remain exportable.
    const columnKey = field => JSON.stringify([field.fieldId, field.label]);
    const columns = new Map();
    for await (const response of FormResponse.find(filter).select('answers.fieldId answers.label').sort({ submittedAt: -1 }).lean().cursor()) {
      for (const answer of response.answers || []) columns.set(columnKey(answer), answer);
    }
    if (!columns.size) for (const field of form.fields || []) columns.set(columnKey(field), field);
    const fields = [...columns.values()];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const teamCodes = new Map((await HackathonTeam.find({ form: form._id }).select('code').lean()).map(team => [String(team._id), team.code]));
    await write(res, '\uFEFF' + ['Yanıt ID', 'Tarih', 'Başvuru Durumu', 'Değerlendirme Notu', 'IP Adresi', 'Doğrulanmış E-posta', 'Doğrulama Yöntemi', 'Takım Adı', 'Takım Kodu', 'Takımdaki Rol', ...fields.map(field => field.label || field.fieldId), 'Eklenen Dosyalar'].map(escapeCsvCell).join(',') + '\r\n');
    const cursor = FormResponse.find(filter).sort({ submittedAt: -1 }).lean().cursor();
    try {
      for await (const response of cursor) {
        const answers = new Map((response.answers || []).map(answer => /** @type {[string, unknown]} */ ([columnKey(answer), answer.value])));
        const row = [response._id, new Date(response.submittedAt).toISOString(), response.status || 'PENDING', response.statusNote || '', response.respondent?.ip || '',
          response.verifiedEmail || '', response.verificationMethod || '',
          response.teamName || '', response.team ? teamCodes.get(String(response.team)) || '' : '', teamRoleLabel(response),
          ...fields.map(field => answers.get(columnKey(field)) ?? ''),
          (response.uploadedFiles || []).map(file => file.url).join(' | ')];
        await write(res, row.map(escapeCsvCell).join(',') + '\r\n');
      }
    } finally { await cursor.close(); }
    res.end();
  } catch (error) { next(error); }
};

// =========================================================================
// PUBLIC CONTROLLERS (For Respondents)
// =========================================================================

/**
 * @desc    Get public form by slug or ID
 * @route   GET /api/v1/forms/public/:slugOrId
 * @access  Public
 */
const getPublicForm = async (req, res, next) => {
  try {
    const { slugOrId } = req.params;

    // Search by slug first, then fallback to ObjectId if valid
    /** @type {Record<string, unknown>} */
    let query = { slug: slugOrId };
    if (/^[0-9a-fA-F]{24}$/.test(slugOrId)) {
      query = { $or: [{ slug: slugOrId }, { _id: slugOrId }] };
    }

    const form = await Form.findOne(query);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'İstenen form bulunamadı.'
      });
    }

    // Check availability
    const now = new Date();

    if (form.status !== 'PUBLISHED') {
      return res.status(403).json({
        success: false,
        message: 'Bu form şu anda yanıtlara kapalıdır.'
      });
    }

    if (form.startDate && now < new Date(form.startDate)) {
      return res.status(403).json({
        success: false,
        message: `Bu form henüz başvuruya açılmamıştır. Başlangıç: ${form.startDate.toISOString()}`
      });
    }

    if (form.endDate && now > new Date(form.endDate)) {
      return res.status(403).json({
        success: false,
        message: 'Bu formun yanıt alma süresi sona ermiştir.'
      });
    }

    if (form.maxSubmissions && form.submissionCount >= form.maxSubmissions) {
      return res.status(403).json({
        success: false,
        message: 'Bu form için belirlenen maksimum başvuru kotası dolmuştur.'
      });
    }

    // Return safe public form metadata and fields
    const publicFormData = {
      id: form._id,
      title: form.title,
      description: form.description,
      slug: form.slug,
      category: form.category,
      bannerImageUrl: form.bannerImageUrl,
      schemaVersion: form.updatedAt,
      startDate: form.startDate,
      endDate: form.endDate,
      settings: form.settings,
      fields: (form.fields || []).sort((a, b) => (a.order || 0) - (b.order || 0))
    };

    return res.status(200).json({
      success: true,
      data: publicFormData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit a response to a form (with support for file uploads)
 * @route   POST /api/v1/forms/public/:slugOrId/submit
 * @access  Public
 */
const submitFormResponse = async (req, res, next) => {
  try {
    // Identity middleware loads the form and authenticates before any file is written.
    const form = req.submissionForm;
    const schemaUpdatedAt = form.updatedAt.getTime();
    if (req.body._formVersion && Date.parse(req.body._formVersion) !== schemaUpdatedAt) return res.status(409).json({ message: 'Form güncellendi. Sayfayı yenileyip tekrar deneyiniz.' });
    const now = new Date();

    if (form.status !== 'PUBLISHED') {
      return res.status(403).json({
        success: false,
        message: 'Bu form şu anda yanıtlara kapalıdır.'
      });
    }

    if (form.startDate && now < new Date(form.startDate)) {
      return res.status(403).json({
        success: false,
        message: 'Bu form henüz yanıtlara açılmamıştır.'
      });
    }

    if (form.endDate && now > new Date(form.endDate)) {
      return res.status(403).json({
        success: false,
        message: 'Bu formun yanıt alma süresi sona ermiştir.'
      });
    }

    if (form.maxSubmissions && form.submissionCount >= form.maxSubmissions) {
      return res.status(403).json({
        success: false,
        message: 'Bu form için belirlenen maksimum başvuru kotası dolmuştur.'
      });
    }

    // Process submitted answers
    let rawAnswers = req.body;
    // If answers were passed as a JSON string (e.g. from multipart form)
    if (typeof rawAnswers.answers === 'string') {
      try {
        rawAnswers = { ...rawAnswers, ...JSON.parse(rawAnswers.answers) };
      } catch {
        return res.status(400).json({ message: 'Yanıtlar geçerli bir JSON nesnesi olmalıdır.' });
      }
    }

    // Map uploaded files by fieldId
    const uploadedFiles = [];
    const filesByField = {};

    if (Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file) => {
        const fileInfo = {
          fieldId: file.fieldname,
          originalName: file.originalname,
          filename: file.filename,
          url: `/api/v1/files/${file.filename}`,
          size: file.size
        };
        uploadedFiles.push(fileInfo);
        filesByField[file.fieldname] = fileInfo.url;
      });
    }

    // Validate answers against form schema
    const structuredAnswers = [];
    const validationErrors = [];
    const fileFields = (form.fields || []).filter(field => field.type === 'file').map(field => field.fieldId);
    if (uploadedFiles.some(file => !fileFields.includes(file.fieldId)) || new Set(uploadedFiles.map(file => file.fieldId)).size !== uploadedFiles.length) validationErrors.push('Beklenmeyen veya yinelenen dosya alanı.');

    for (const field of form.fields || []) {
      const fieldId = field.fieldId;
      let val = rawAnswers[fieldId];

      // If it's a file field, check filesByField or string URL
      if (field.type === 'file') {
        val = filesByField[fieldId] || null;
      }

      const message = answerError(field, val);
      if (message) validationErrors.push(`'${field.label}' ${message}.`);

      structuredAnswers.push({
        fieldId,
        label: field.label,
        value: val !== undefined ? val : null
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join(' ')
      });
    }

    // Save response
    const clientIp = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const teamField = (form.fields || []).find(field => field.type === 'team');
    const teamValue = teamField ? rawAnswers[teamField.fieldId] : null;
    const teamAnswer = teamField && teamValue != null && teamValue !== '' ? { fieldId: teamField.fieldId, value: teamValue } : null;

    const { response, teamResult } = await saveSubmission(form._id, {
      schemaUpdatedAt,
      schemaVersion: form.updatedAt,
      participant: req.participant?._id || null,
      verifiedEmail: req.participant?.email || null,
      verificationMethod: req.participantVerification?.method || null,
      verifiedAt: req.participantVerification?.verifiedAt || null,
      form: form._id,
      formSlug: form.slug,
      answers: structuredAnswers,
      uploadedFiles,
      respondent: {
        ip: clientIp,
        userAgent,
        user: req.user ? req.user._id : null
      }
    }, req.participant, teamAnswer);
    req.submissionSaved = true;

    return res.status(201).json({
      success: true,
      message: form.settings?.successMessage || 'Form yanıtınız başarıyla kaydedildi!',
      responseId: response._id,
      // Only the captain receives the join code; a joining member gets the team name and pending status.
      team: teamResult ? {
        name: teamResult.team.name,
        role: teamResult.role,
        status: teamResult.status,
        ...(teamResult.role === 'CAPTAIN' ? { code: teamResult.team.code } : {})
      } : null
    });
  } catch (error) {
    next(error);
  } finally {
    if (!req.submissionSaved && Array.isArray(req.files)) {
      await Promise.all(req.files.map(file => unlink(file.path).catch(() => {})));
    }
  }
};

/**
 * @desc    Tell a verified participant whether they already applied to this form
 * @route   GET /api/v1/forms/public/:slugOrId/my-submission
 * @access  Participant (Bearer token from email OTP / Google)
 * Only existence, status and date are returned; answers stay staff-only.
 */
const getMySubmission = async (req, res, next) => {
  try {
    if (!req.participant) {
      return res.status(401).json({ success: false, message: 'Başvurunu görmek için e-posta adresini doğrula.' });
    }
    const response = await FormResponse.findOne({
      form: req.submissionForm._id,
      $or: [{ participant: req.participant._id }, { verifiedEmail: req.participant.email }]
    }).sort({ submittedAt: -1 }).select('status submittedAt').lean();

    return res.status(200).json({
      success: true,
      data: response
        ? { submitted: true, status: response.status || 'PENDING', submittedAt: response.submittedAt }
        : { submitted: false }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Preview the team behind a join code while filling the form
 * @route   GET /api/v1/forms/public/:slugOrId/teams/:code
 * @access  Participant (Bearer token)
 * Returns only name and size; members' identities are never exposed.
 */
const lookupFormTeam = async (req, res, next) => {
  try {
    if (!req.participant) {
      return res.status(401).json({ success: false, message: 'Takım kodunu denemek için e-posta adresini doğrula.' });
    }
    const team = await lookupTeam({ form: req.submissionForm, code: req.params.code });
    if (!team) return res.status(404).json({ success: false, message: 'Bu kodla bir takım bulunamadı. Kodu kaptanından kontrol et.' });
    return res.status(200).json({ success: true, data: team });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  lookupFormTeam,
  getMySubmission,
  createForm,
  getAllForms,
  getFormById,
  updateForm,
  updateFormStatus,
  deleteForm,
  getFormResponses,
  updateFormResponseStatus,
  exportFormResponses,
  getPublicForm,
  submitFormResponse
};

