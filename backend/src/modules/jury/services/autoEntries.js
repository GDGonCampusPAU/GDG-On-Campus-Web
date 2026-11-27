// Teams that added a project link on the upload site compete without the organizers adding them by hand.
//
// A team is added to "Yarışan takımlar" (JudgingConfig.entries) when it saves its first link, and every
// team that already has a link is picked up when the jury setup is opened or evaluation is opened. A team
// an organizer removed from the list is remembered (excludedTeams) and never comes back on its own; adding
// it again by hand clears that. Nothing changes while scoring is locked.
const mongoose = require('mongoose');
const Form = require('../../../models/Form');
const HackathonTeam = require('../../../models/HackathonTeam');
const JudgingConfig = require('../models/JudgingConfig');
const ProjectSubmission = require('../../projectUpload/models/ProjectSubmission');

const FORM_SLUG = 'hackathon-katilim';
const ATTEMPTS = 3;

/**
 * Adds the teams with a project link that are not competing yet.
 * @param {unknown[]} [teamIds] only these teams (default: every team with a link)
 * @returns {Promise<number>} how many were added
 */
const addUploadedTeams = async (teamIds) => {
  const form = await Form.findOne({ slug: FORM_SLUG }).select('_id').lean();
  if (!form) return 0;
  /** @type {any} */
  const filter = { form: form._id, ...(teamIds ? { team: { $in: teamIds } } : {}) };
  /** @type {{ team: any, createdAt: Date }[]} */
  const uploaded = /** @type {any} */ (await ProjectSubmission.find(filter).select('team createdAt').sort({ createdAt: 1 }).lean());
  if (!uploaded.length) return 0;

  // The setup document may not exist yet (first visit): create it with the defaults.
  await require('./configService').loadConfig();
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const config = await JudgingConfig.findById(JudgingConfig.CONFIG_ID).select('entries excludedTeams locked revision').lean();
    if (!config || config.locked) return 0;
    const known = new Set([...(config.entries || []).map(entry => String(entry.team)), ...(config.excludedTeams || []).map(String)]);
    const missing = uploaded.filter(item => !known.has(String(item.team)));
    if (!missing.length) return 0;
    const teams = await HackathonTeam.find({ _id: { $in: missing.map(item => item.team) }, form: form._id }).select('name').lean();
    const nameOf = new Map(teams.map(team => [String(team._id), team.name]));
    let order = Math.max(0, ...(config.entries || []).map(entry => entry.order));
    // Upload order, so the manual order of new teams matches who uploaded first.
    const added = missing.filter(item => nameOf.has(String(item.team)))
      .map(item => ({ team: new mongoose.Types.ObjectId(String(item.team)), teamName: nameOf.get(String(item.team)), order: ++order }));
    if (!added.length) return 0;
    // Revision guard: an organizer saving the setup at the same moment wins, and we try again on top of it.
    const res = await JudgingConfig.updateOne({ _id: JudgingConfig.CONFIG_ID, revision: config.revision, locked: { $ne: true } },
      { $push: { entries: { $each: added } }, $inc: { revision: 1 } });
    if (res.modifiedCount) return added.length;
  }
  return 0;
};

/** Never lets a page fail because of the automatic add. */
const addUploadedTeamsSafely = async (teamIds) => {
  try {
    return await addUploadedTeams(teamIds);
  } catch (error) {
    console.error('[Jüri] Proje linki olan takımlar eklenemedi:', /** @type {any} */ (error)?.message);
    return 0;
  }
};

module.exports = { addUploadedTeams, addUploadedTeamsSafely };
