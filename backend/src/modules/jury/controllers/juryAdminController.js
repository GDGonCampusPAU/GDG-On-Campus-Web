const configAdmin = require('../services/configAdminService');
const jurorAdmin = require('../services/jurorAdminService');
const results = require('../services/resultsService');
const scorecardAdmin = require('../services/scorecardAdminService');
const audit = require('../services/auditService');
const live = require('../services/liveService');
const { respond } = require('./respond');

/**
 * @desc    Criteria, categories, competing teams, lock state
 * @route   GET /api/v1/jury-admin/config
 * @access  Private (ORGANIZER, ADMIN)
 */
const getConfig = respond(() => configAdmin.getConfig());

/**
 * @desc    Replace the setup; a stale `revision` gives 409
 * @route   PUT /api/v1/jury-admin/config
 * @access  Private (ORGANIZER, ADMIN)
 */
const saveConfig = respond(req => configAdmin.saveConfig(req.body, req.user));

/**
 * @desc    Teams that can be added as entries
 * @route   GET /api/v1/jury-admin/teams
 * @access  Private (ORGANIZER, ADMIN)
 */
const listTeams = respond(() => configAdmin.listTeams());

/**
 * @desc    Jurors with last seen time and progress
 * @route   GET /api/v1/jury-admin/jurors
 * @access  Private (ORGANIZER, ADMIN)
 */
const listJurors = respond(() => jurorAdmin.listJurors());

/**
 * @desc    New juror; the plain token is returned only here
 * @route   POST /api/v1/jury-admin/jurors
 * @access  Private (ADMIN)
 */
const createJuror = respond(req => jurorAdmin.createJuror(req.body.name, req.user), 201);

/**
 * @desc    New token; the old link stops working
 * @route   POST /api/v1/jury-admin/jurors/:id/regenerate
 * @access  Private (ADMIN)
 */
const regenerateToken = respond(req => jurorAdmin.regenerateToken(req.params.id, req.user));

/**
 * @desc    Rename, activate or deactivate a juror
 * @route   PATCH /api/v1/jury-admin/jurors/:id
 * @access  Private (ORGANIZER, ADMIN)
 */
const updateJuror = respond(req => jurorAdmin.updateJuror(req.params.id, req.body, req.user));

/**
 * @desc    Lock or open scoring
 * @route   PUT /api/v1/jury-admin/lock
 * @access  Private (lock: ORGANIZER, ADMIN; unlock: ADMIN)
 */
const setLock = respond(req => configAdmin.setLock(req.body.locked, req.user));

/**
 * @desc    Delete all scorecards after a typed confirmation
 * @route   POST /api/v1/jury-admin/scorecards/reset
 * @access  Private (ADMIN)
 */
const resetScorecards = respond(req => configAdmin.resetScorecards(req.body.confirm, req.user));

/**
 * @desc    Take one submitted card out of the results, with a reason
 * @route   POST /api/v1/jury-admin/jurors/:id/scorecards/:teamId/void
 * @access  Private (ADMIN)
 */
const voidScorecard = respond(req => scorecardAdmin.voidScorecard(req.params.id, req.params.teamId, req.body, req.user));

/**
 * @desc    Who changed what, newest first
 * @route   GET /api/v1/jury-admin/log
 * @access  Private (ORGANIZER, ADMIN)
 */
const getLog = respond(req => audit.listLog(req.query.before));

/**
 * @desc    Ranking, award suggestions, every juror's scores and comments
 * @route   GET /api/v1/jury-admin/results
 * @access  Private (ORGANIZER, ADMIN)
 */
const getResults = respond(() => results.getResults());

/**
 * @desc    Team × criterion × juror dump for Excel
 * @route   GET /api/v1/jury-admin/results.csv
 * @access  Private (ORGANIZER, ADMIN)
 * @type {import('express').RequestHandler}
 */
const exportResults = async (_req, res, next) => {
  try {
    const csv = await results.getResultsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="juri_sonuclari.csv"');
    return res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Live presentation session: order, team being voted, who has voted
 * @route   GET /api/v1/jury-admin/live
 * @access  Private (ORGANIZER, ADMIN)
 */
const getLive = respond(() => live.adminView());

/**
 * @desc    Start voting for the team on stage; ending it needs every active juror's vote or force: true
 * @route   POST /api/v1/jury-admin/live/start, /live/end
 * @access  Private (ORGANIZER, ADMIN)
 */
const startVoting = respond(req => live.start(req.body.team, req.user));
const endVoting = respond(req => live.end(req.body.force, req.user));

/**
 * @desc    Reopen a closed team's voting; new random order before anything was voted
 * @route   POST /api/v1/jury-admin/live/reopen, /live/shuffle
 * @access  Private (ADMIN)
 */
const reopenVoting = respond(req => live.reopen(req.body.team, req.user));
const shuffleOrder = respond(req => live.reshuffle(req.user));

module.exports = {
  getLive, startVoting, endVoting, reopenVoting, shuffleOrder, getConfig, saveConfig, listTeams, listJurors, createJuror, regenerateToken, updateJuror, setLock, resetScorecards, voidScorecard, getLog, getResults, exportResults };
