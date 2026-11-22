const juryRoutes = require('./routes/juryRoutes');
const juryAdminRoutes = require('./routes/juryAdminRoutes');
const { loadConfig } = require('./services/configService');

/**
 * Jury scoring module (docs/JURI_PUANLAMA_SPEC.md).
 * Both routers must be mounted before the general API limiter and the body parsers, see app.js.
 */
const init = async () => {
  await Promise.all([require('./models/Juror').init(), require('./models/Scorecard').init(), require('./models/JudgingConfig').init(),
    require('./models/JuryAuditLog').init()]);
  await loadConfig();
};

module.exports = { juryRoutes, juryAdminRoutes, init };
