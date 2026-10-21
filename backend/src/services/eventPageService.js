const mongoose = require('mongoose');
const EventPage = require('../models/EventPage');
const Form = require('../models/Form');
const base = require('../../../shared/hackathon-event.json');
const FORM_SLUG = 'hackathon-katilim';
const fieldsFor = event => event.register.steps.flatMap(step => step.fields).map((field, order) => ({
  fieldId: field.id, label: field.label, description: field.hint, type: field.kind === 'tel' ? 'phone' : field.kind,
  required: field.required === 'yes', options: field.options.map(option => option.value), order
}));
const formData = event => ({ title: event.register.title, slug: FORM_SLUG, category: 'HACKATHON', eventKey: 'hackathon',
  fields: fieldsFor(event), status: event.register.status === 'open' ? 'PUBLISHED' : 'CLOSED',
  settings: { verificationRequired: true, verificationMethods: ['GOOGLE', 'EMAIL_OTP'], allowMultipleSubmissions: false, successMessage: event.register.successText }
});
const ensureHackathonPage = async () => {
  await mongoose.connection.transaction(async session => {
    if (await EventPage.exists({ _id: 'hackathon' }).session(session)) return;
    let form = await Form.findOne({ slug: FORM_SLUG }).session(session);
    if (!form) { [form] = await Form.create([formData(base)], { session }); }
    await EventPage.create([{ _id: 'hackathon', event: base, formSlug: form.slug }], { session });
  });
};
const savePage = async (event, revision, userId) => {
  const { isEventShape } = await import('../../../shared/eventContent.mjs');
  if (!isEventShape(base, event)) throw Object.assign(new Error('Etkinlik verisi geçersiz.'), { status: 400 });
  if (!Number.isInteger(revision) || revision < 1) throw Object.assign(new Error('Yayın sürümü gerekli.'), { status: 400 });
  let page;
  await mongoose.connection.transaction(async session => {
    page = await EventPage.findOneAndUpdate({ _id: 'hackathon', revision }, {
      $set: { event, updatedBy: userId }, $inc: { revision: 1 }
    }, { session, returnDocument: 'after' });
    if (!page) throw Object.assign(new Error('İçerik başka bir oturumda güncellendi. Yenileyip tekrar deneyin.'), { status: 409 });
    const form = await Form.findOne({ slug: page.formSlug }).session(session);
    if (!form) throw Object.assign(new Error('Başvuru formu bulunamadı.'), { status: 409 });
    // Preserve submission count, capacity and dates while updating the published schema.
    const data = formData(event);
    form.fields = data.fields; form.title = data.title; form.status = data.status;
    form.settings.successMessage = data.settings.successMessage;
    await form.save({ session });
  });
  return page;
};
module.exports = { ensureHackathonPage, savePage, FORM_SLUG };
