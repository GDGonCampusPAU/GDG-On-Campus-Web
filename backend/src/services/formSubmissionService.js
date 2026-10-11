const mongoose = require('mongoose');
const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const { failure } = require('../modules/participantAuth/services/otpService');

const saveSubmission = async (formId, responseData, participant) => {
  let response;
  await mongoose.connection.transaction(async (session) => {
    // Every submission writes the same form first. Transaction retries serialize
    // capacity checks, repeat checks, and counter updates for that form.
    const now = new Date();
    const form = await Form.findOneAndUpdate({ _id: formId, status: 'PUBLISHED', $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      { $expr: { $or: [{ $eq: [{ $ifNull: ['$maxSubmissions', null] }, null] },
        { $eq: ['$maxSubmissions', 0] }, { $lt: ['$submissionCount', '$maxSubmissions'] }] } }
    ] }, { $inc: { submissionCount: 1 } }, { returnDocument: 'after', session, timestamps: false });
    if (!form) throw failure(403, 'Form kapalı, süresi dolmuş veya kotası dolmuş.');
    // Do not silently submit against a form schema/settings changed during upload.
    if (String(form.updatedAt.getTime()) !== String(responseData.schemaUpdatedAt)) {
      throw failure(409, 'Form güncellenmiş. Formu yeniden açıp tekrar gönderiniz.');
    }
    if (!form.settings.allowMultipleSubmissions) {
      if (!participant) throw failure(401, 'Tek başvuru için katılımcı doğrulaması gereklidir.');
      if (await FormResponse.exists({ form: formId, participant: participant._id }).session(session)) {
        throw failure(409, 'Bu forma daha önce başvurdunuz.');
      }
    }
    const { schemaUpdatedAt, ...data } = responseData;
    const created = await FormResponse.create([{ ...data,
      ...(!form.settings.allowMultipleSubmissions ? { singleSubmissionKey: String(participant._id) } : {})
    }], { session });
    response = created[0];
  });
  return response;
};
module.exports = { saveSubmission };
