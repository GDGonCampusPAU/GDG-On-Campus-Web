const mongoose = require('mongoose');
const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const { failure } = require('../modules/participantAuth/services/otpService');
const { applyTeamChoice, teamSummary } = require('./teamService');

/**
 * Saves a form response; when the form has a `team` field, creates/joins the team in the
 * same transaction so a failed submission never leaves an orphan team or membership.
 * @param {any} formId
 * @param {Record<string, any>} responseData
 * @param {any} participant
 * @param {{ fieldId: string, value: any } | null} [teamAnswer]
 */
const saveSubmission = async (formId, responseData, participant, teamAnswer = null) => {
  /** @type {import('mongoose').HydratedDocument<any> | undefined} */
  let response;
  /** @type {Awaited<ReturnType<typeof applyTeamChoice>>} */
  let teamResult = null;
  try {
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
      const data = { ...responseData };
      delete data.schemaUpdatedAt;
      teamResult = null;
      if (teamAnswer) {
        teamResult = await applyTeamChoice({ session, form, participant, value: teamAnswer.value });
        data.answers = data.answers.map(answer => answer.fieldId === teamAnswer.fieldId
          ? { ...answer, value: teamSummary(teamAnswer.value, teamResult) } : answer);
        if (teamResult) Object.assign(data, { team: teamResult.team._id, teamName: teamResult.team.name, teamRole: teamResult.role, teamStatus: teamResult.status });
      }
      const created = await FormResponse.create([{ ...data,
        ...(!form.settings.allowMultipleSubmissions ? { singleSubmissionKey: String(participant._id) } : {})
      }], { session });
      response = created[0];
      if (teamResult) {
        const team = teamResult.team;
        if (teamResult.role === 'CAPTAIN') team.captain.response = response._id;
        else team.members.find(member => String(member.participant) === String(participant._id)).response = response._id;
        await team.save({ session });
      }
    });
  } catch (error) {
    // A concurrent registration won the unique team name/code: answer in plain Turkish.
    if (error?.code === 11000 && error.keyPattern?.nameKey) throw failure(400, 'Bu takım adı alınmış. Başka bir ad dene.');
    if (error?.code === 11000 && error.keyPattern?.code) throw failure(503, 'Takım kodu üretilemedi. Lütfen tekrar dene.');
    throw error;
  }
  // The transaction either assigned the response or threw; guard keeps the contract explicit.
  if (!response) throw new Error('Form yanıtı kaydedilemedi.');
  return { response, teamResult };
};
module.exports = { saveSubmission };
