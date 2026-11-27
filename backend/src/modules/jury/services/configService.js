const JudgingConfig = require('../models/JudgingConfig');
const { DEFAULT_CRITERIA, DEFAULT_CATEGORIES } = require('../defaults');

const { CONFIG_ID } = JudgingConfig;

/** Creates the config with the spec defaults on first use and never overwrites an existing one. */
/**
 * A project name typed in the jury setup wins; otherwise the one the team gave on the project upload
 * site. Every screen (juror, live order, results) reads entries through here.
 */
const withProjectNames = async (config) => {
  const missing = (config?.entries || []).filter(entry => !entry.projectName).map(entry => entry.team);
  if (!missing.length) return config;
  const ProjectSubmission = require('../../projectUpload/models/ProjectSubmission');
  const uploads = await ProjectSubmission.find({ team: { $in: missing }, projectName: { $nin: [null, ''] } }).select('team projectName').lean();
  if (!uploads.length) return config;
  const nameOf = new Map(uploads.map(item => [String(item.team), item.projectName]));
  return { ...config, entries: config.entries.map(entry => (entry.projectName ? entry : { ...entry, projectName: nameOf.get(String(entry.team)) || '' })) };
};

const loadConfig = async () => {
  const config = await JudgingConfig.findById(CONFIG_ID).lean();
  if (config) return withProjectNames(config);
  return JudgingConfig.findOneAndUpdate(
    { _id: CONFIG_ID },
    { $setOnInsert: { criteria: DEFAULT_CRITERIA, categories: DEFAULT_CATEGORIES } },
    { upsert: true, returnDocument: 'after' }
  ).lean();
};

module.exports = { loadConfig };
