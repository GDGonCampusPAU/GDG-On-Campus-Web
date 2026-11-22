const juryService = require('../services/juryService');
const { respond } = require('./respond');

/**
 * @desc    Juror name, lock state, criteria, categories and teams with this juror's status
 * @route   GET /api/v1/jury/me
 * @access  Juror link
 */
const getMe = respond(req => juryService.overview(req.juror));

/**
 * @desc    One team with this juror's own scorecard
 * @route   GET /api/v1/jury/entries/:teamId
 * @access  Juror link
 */
const getEntry = respond(req => juryService.getEntry(req.juror, req.params.teamId));

/**
 * @desc    Save a draft or submit the scorecard
 * @route   PUT /api/v1/jury/entries/:teamId/scorecard
 * @access  Juror link
 */
const saveScorecard = respond(req => juryService.saveScorecard(req.juror, req.params.teamId, req.body));

module.exports = { getMe, getEntry, saveScorecard };
