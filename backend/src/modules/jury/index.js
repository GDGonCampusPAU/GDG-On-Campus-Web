const juryRoutes = require('./routes/juryRoutes');
const juryAdminRoutes = require('./routes/juryAdminRoutes');
const limits = require('./middleware/limits');
const { loadConfig } = require('./services/configService');

/**
 * Jury scoring module (docs/JURI_PUANLAMA_SPEC.md).
 * `limits` must be mounted before the general API limiter, see app.js.
 */
const init = async () => {
  await Promise.all([require('./models/Juror').init(), require('./models/Scorecard').init(), require('./models/JudgingConfig').init()]);
  await loadConfig();
};

module.exports = { juryRoutes, juryAdminRoutes, limits, init };
