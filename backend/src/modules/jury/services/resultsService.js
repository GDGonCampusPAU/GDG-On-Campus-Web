const HackathonTeam = require('../../../models/HackathonTeam');
const { escapeCsvCell } = require('../../../utils/query');
const Juror = require('../models/Juror');
const Scorecard = require('../models/Scorecard');
const { loadConfig } = require('./configService');
const { computeResults, cardTotal } = require('./computeResults');

const getResults = async () => {
  const config = await loadConfig();
  const [jurors, cards, existingTeams] = await Promise.all([
    Juror.find().sort({ createdAt: 1 }).lean(),
    Scorecard.find().lean(),
    HackathonTeam.find({ _id: { $in: config.entries.map(entry => entry.team) } }).select('_id').lean()
  ]);
  const { ranking, categories } = computeResults(config, config.entries, cards);
  const entryById = new Map(config.entries.map(entry => [String(entry.team), entry]));
  const existing = new Set(existingTeams.map(team => String(team._id)));
  const active = jurors.filter(juror => juror.active);

  const teams = ranking.map(result => {
    const entry = entryById.get(result.team);
    const teamCards = cards.filter(card => String(card.team) === result.team);
    const cardOf = juror => teamCards.find(card => String(card.juror) === String(juror._id));
    return {
      ...result,
      teamName: entry.teamName,
      projectName: entry.projectName,
      teamMissing: !existing.has(result.team),
      // A draft does not count, so that juror is still missing.
      missingJurors: active.filter(juror => cardOf(juror)?.status !== 'SUBMITTED')
        .map(juror => ({ name: juror.name, hasDraft: cardOf(juror)?.status === 'DRAFT' })),
      cards: jurors.filter(juror => cardOf(juror)?.status === 'SUBMITTED').map(juror => {
        const card = cardOf(juror);
        return {
          juror: { id: String(juror._id), name: juror.name, active: juror.active },
          total: cardTotal(config.criteria, card.scores),
          scores: card.scores.map(({ criterion, value, comment }) => ({ criterion, value: value ?? null, comment })),
          nominations: card.nominations,
          generalComment: card.generalComment,
          submittedAt: card.submittedAt
        };
      })
    };
  });

  return {
    generatedAt: new Date(),
    locked: config.locked,
    activeJurorCount: active.length,
    criteria: config.criteria,
    categoryNames: Object.fromEntries(config.categories.map(category => [category.key, category.name])),
    ranking: teams,
    categories
  };
};

const CSV_HEADER = ['Sunum Sırası', 'Takım', 'Proje', 'Jüri', 'Kriter', 'Ağırlık', 'Puan', 'Gerekçe', 'Jüri Toplamı', 'Genel Yorum', 'Adaylıklar'];

/**
 * One row per team × criterion × juror (submitted cards only).
 * Semicolons and decimal commas, because Excel with Turkish regional settings expects them.
 */
const getResultsCsv = async () => {
  const { ranking, criteria, categoryNames } = await getResults();
  /** @type {unknown[][]} */
  const rows = [CSV_HEADER];
  for (const team of [...ranking].sort((a, b) => a.order - b.order)) {
    const lead = [team.order, team.teamName, team.projectName];
    // Unscored teams keep one row so nobody looks like they were left out.
    if (!team.cards.length) rows.push([...lead, '', '', '', '', '', '', '', '']);
    for (const card of team.cards) {
      for (const criterion of criteria) {
        const score = card.scores.find(item => item.criterion === criterion.key);
        rows.push([...lead, card.juror.name, criterion.label, criterion.weight, score?.value, score?.comment,
          String(card.total).replace('.', ','), card.generalComment, card.nominations.map(key => categoryNames[key] ?? key).join(', ')]);
      }
    }
  }
  return `﻿${rows.map(row => row.map(escapeCsvCell).join(';')).join('\r\n')}\r\n`;
};

module.exports = { getResults, getResultsCsv };
