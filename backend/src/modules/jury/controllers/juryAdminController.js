const configAdmin = require('../services/configAdminService');
const jurorAdmin = require('../services/jurorAdminService');
const results = require('../services/resultsService');
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
const saveConfig = respond(req => configAdmin.saveConfig(req.body, req.user._id));

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
 * @access  Private (ORGANIZER, ADMIN)
 */
const createJuror = respond(req => jurorAdmin.createJuror(req.body.name), 201);

/**
 * @desc    New token; the old link stops working
 * @route   POST /api/v1/jury-admin/jurors/:id/regenerate
 * @access  Private (ORGANIZER, ADMIN)
 */
const regenerateToken = respond(req => jurorAdmin.regenerateToken(req.params.id));

/**
 * @desc    Rename, activate or deactivate a juror
 * @route   PATCH /api/v1/jury-admin/jurors/:id
 * @access  Private (ORGANIZER, ADMIN)
 */
const updateJuror = respond(req => jurorAdmin.updateJuror(req.params.id, req.body));

/**
 * @desc    Lock or open scoring
 * @route   PUT /api/v1/jury-admin/lock
 * @access  Private (ORGANIZER, ADMIN)
 */
const setLock = respond(req => configAdmin.setLock(req.body.locked, req.user._id));

/**
 * @desc    Delete all scorecards after a typed confirmation
 * @route   POST /api/v1/jury-admin/scorecards/reset
 * @access  Private (ADMIN)
 */
const resetScorecards = respond(req => configAdmin.resetScorecards(req.body.confirm, req.user._id));

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

module.exports = { getConfig, saveConfig, listTeams, listJurors, createJuror, regenerateToken, updateJuror, setLock, resetScorecards, getResults, exportResults };
