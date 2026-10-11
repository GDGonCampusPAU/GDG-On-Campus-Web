const { saveSubmission } = require('../services/formSubmissionService');
const { unlink } = require('node:fs/promises');
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
const escapeCsvCell = (val) => {
  if (val === null || val === undefined) return '""';
  if (Array.isArray(val)) {
    val = val.join(', ');
  } else if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

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

    if (req.query.status) {
      filter.status = req.query.status.toUpperCase();
    }

    if (req.query.category) {
      filter.category = req.query.category.toUpperCase();
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
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

    if (title !== undefined) form.title = title.trim();
    if (description !== undefined) form.description = description.trim();
    if (status !== undefined) form.status = status;
    if (category !== undefined) form.category = category.trim().toUpperCase();
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
      form.fields = fields.map((f, index) => ({
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

    const form = await Form.findByIdAndUpdate(req.params.id, { status }, { new: true });
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

    await Promise.all([
      Form.findByIdAndDelete(form._id),
      FormResponse.deleteMany({ form: form._id })
    ]);

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

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [responses, totalItems] = await Promise.all([
      FormResponse.find({ form: form._id })
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FormResponse.countDocuments({ form: form._id })
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      form: {
        id: form._id,
        title: form.title,
        slug: form.slug,
        fields: form.fields
      },
      data: responses,
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
 * @desc    Export form responses as CSV or JSON
 * @route   GET /api/v1/forms/:id/responses/export
 * @access  Private (ORGANIZER, ADMIN)
 */
const exportFormResponses = async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form bulunamadı.'
      });
    }

    const format = (req.query.format || 'csv').toLowerCase();
    const responses = await FormResponse.find({ form: form._id })
      .sort({ submittedAt: -1 })
      .lean();

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${form.slug}-responses.json"`
      );
      return res.status(200).send(JSON.stringify(responses, null, 2));
    }

    // Dynamic CSV generation: each question becomes a dedicated column header!
    const sortedFields = [...(form.fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

    const standardHeaders = ['Yanıt ID', 'Tarih', 'IP Adresi', 'Doğrulanmış E-posta', 'Doğrulama Yöntemi'];
    const questionHeaders = sortedFields.map((f) => f.label || f.fieldId);
    const fileHeaders = ['Eklenen Dosyalar'];
    const allHeaders = [...standardHeaders, ...questionHeaders, ...fileHeaders];

    const rows = responses.map((resp) => {
      const answersMap = {};
      (resp.answers || []).forEach((ans) => {
        answersMap[ans.fieldId] = ans.value;
      });

      const rowValues = [
        resp._id,
        new Date(resp.submittedAt).toISOString(),
        resp.respondent?.ip || '',
        resp.verifiedEmail || '',
        resp.verificationMethod || ''
      ];

      // Add answer for each question column
      sortedFields.forEach((f) => {
        rowValues.push(answersMap[f.fieldId] !== undefined ? answersMap[f.fieldId] : '');
      });

      // Add file URLs
      const fileUrls = (resp.uploadedFiles || []).map((fl) => fl.url).join(' | ');
      rowValues.push(fileUrls);

      return rowValues.map(escapeCsvCell).join(',');
    });

    const csvContent =
      '\uFEFF' + [allHeaders.map(escapeCsvCell).join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${form.slug}-responses.csv"`
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
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
      } catch (e) {
        // keep rawAnswers as is
      }
    }

    // Map uploaded files by fieldId
    const protocol = req.protocol;
    const host = req.get('host');
    const uploadedFiles = [];
    const filesByField = {};

    if (Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file) => {
        const fileInfo = {
          fieldId: file.fieldname,
          originalName: file.originalname,
          filename: file.filename,
          url: `${protocol}://${host}/uploads/${file.filename}`,
          size: file.size
        };
        uploadedFiles.push(fileInfo);
        filesByField[file.fieldname] = fileInfo.url;
      });
    }

    // Validate answers against form schema
    const structuredAnswers = [];
    const validationErrors = [];

    for (const field of form.fields || []) {
      const fieldId = field.fieldId;
      let val = rawAnswers[fieldId];

      // If it's a file field, check filesByField or string URL
      if (field.type === 'file') {
        val = filesByField[fieldId] || val || null;
      }

      // Check required
      if (field.required) {
        const isEmpty =
          val === undefined ||
          val === null ||
          (typeof val === 'string' && val.trim().length === 0) ||
          (Array.isArray(val) && val.length === 0);

        if (isEmpty) {
          validationErrors.push(`'${field.label}' alanı zorunludur.`);
          continue;
        }
      }

      // Basic type validation if present
      if (val !== undefined && val !== null && val !== '') {
        if (field.type === 'email' && typeof val === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val.trim())) {
            validationErrors.push(`'${field.label}' için geçerli bir e-posta adresi giriniz.`);
          }
        } else if (field.type === 'number') {
          const num = Number(val);
          if (isNaN(num)) {
            validationErrors.push(`'${field.label}' sayısal bir değer olmalıdır.`);
          } else {
            if (field.validation?.min != null && num < field.validation.min) {
              validationErrors.push(`'${field.label}' en az ${field.validation.min} olmalıdır.`);
            }
            if (field.validation?.max != null && num > field.validation.max) {
              validationErrors.push(`'${field.label}' en fazla ${field.validation.max} olabilir.`);
            }
          }
        }
      }

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

    const response = await saveSubmission(form._id, {
      schemaUpdatedAt,
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
    }, req.participant);
    req.submissionSaved = true;

    return res.status(201).json({
      success: true,
      message: form.settings?.successMessage || 'Form yanıtınız başarıyla kaydedildi!',
      responseId: response._id
    });
  } catch (error) {
    next(error);
  } finally {
    if (!req.submissionSaved && Array.isArray(req.files)) {
      await Promise.all(req.files.map(file => unlink(file.path).catch(() => {})));
    }
  }
};

module.exports = {
  createForm,
  getAllForms,
  getFormById,
  updateForm,
  updateFormStatus,
  deleteForm,
  getFormResponses,
  exportFormResponses,
  getPublicForm,
  submitFormResponse
};

