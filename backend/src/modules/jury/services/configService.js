const JudgingConfig = require('../models/JudgingConfig');
const { DEFAULT_CRITERIA, DEFAULT_CATEGORIES } = require('../defaults');

const { CONFIG_ID } = JudgingConfig;

/** Creates the config with the spec defaults on first use and never overwrites an existing one. */
const loadConfig = async () => {
  const config = await JudgingConfig.findById(CONFIG_ID).lean();
  if (config) return config;
  return JudgingConfig.findOneAndUpdate(
    { _id: CONFIG_ID },
    { $setOnInsert: { criteria: DEFAULT_CRITERIA, categories: DEFAULT_CATEGORIES } },
    { upsert: true, returnDocument: 'after' }
  ).lean();
};

module.exports = { loadConfig };
