// Scoring rules of the jury system (pure function, no database).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeResults, cardTotal } = require('../src/modules/jury/services/computeResults');
const { DEFAULT_CRITERIA, DEFAULT_CATEGORIES } = require('../src/modules/jury/defaults');

const config = { criteria: DEFAULT_CRITERIA, categories: DEFAULT_CATEGORIES };
const entries = (...teams) => teams.map((team, index) => ({ team, order: index + 1 }));
/** All criteria get `base`; `values` overrides single criteria. */
const card = (team, base, { values = {}, nominations = [], status = 'SUBMITTED', juror = 'j1' } = {}) => ({
  team, juror, status, nominations,
  scores: DEFAULT_CRITERIA.map(({ key }) => ({ criterion: key, value: values[key] === undefined ? base : values[key] }))
});
const only = (...keys) => ({ criteria: DEFAULT_CRITERIA, categories: DEFAULT_CATEGORIES.filter(category => keys.includes(category.key)) });
const winners = result => Object.fromEntries(result.categories.map(category => [category.key, category.winner]));

test('default weights add up to 100', () => {
  assert.equal(DEFAULT_CRITERIA.reduce((sum, criterion) => sum + criterion.weight, 0), 100);
});

test('juror total is the weighted sum on a 0-100 scale', () => {
  assert.equal(cardTotal(DEFAULT_CRITERIA, card('a', 5).scores), 100);
  assert.equal(cardTotal(DEFAULT_CRITERIA, card('a', 1).scores), 20);
  // 25×5 + 75×3 = 350, divided by 5
  assert.equal(cardTotal(DEFAULT_CRITERIA, card('a', 3, { values: { technical: 5 } }).scores), 70);
});

test('a half-filled card totals only what is filled in', () => {
  assert.equal(cardTotal(DEFAULT_CRITERIA, card('a', null, { values: { technical: 4 } }).scores), 20);
});

test('team score is the average of the juror totals', () => {
  const [team] = computeResults(config, entries('a'), [card('a', 5), card('a', 2, { juror: 'j2' })]).ranking;
  assert.equal(team.overall, 70);
  assert.equal(team.judgeCount, 2);
  assert.equal(team.criterionAverages.demo, 3.5);
});

test('drafts count neither for scores nor for nominations', () => {
  const result = computeResults(only('dreamTeam'), entries('a'), [
    card('a', 4), card('a', 1, { juror: 'j2', status: 'DRAFT', nominations: ['dreamTeam'] })]);
  assert.equal(result.ranking[0].overall, 80);
  assert.equal(result.ranking[0].judgeCount, 1);
  assert.deepEqual(result.ranking[0].nominationCounts, {});
  assert.equal(result.categories[0].winner, null);
});

test('missing jurors do not pull the average down', () => {
  const { ranking } = computeResults(config, entries('a', 'b'), [card('a', 4), card('a', 4, { juror: 'j2' }), card('b', 5)]);
  assert.deepEqual(ranking.map(team => [team.team, team.overall, team.judgeCount]), [['b', 100, 1], ['a', 80, 2]]);
});

test('unscored teams stay at the bottom without a rank', () => {
  const { ranking } = computeResults(config, entries('a', 'b', 'c'), [card('c', 1)]);
  assert.deepEqual(ranking.map(team => [team.team, team.rank, team.overall]), [['c', 1, 20], ['a', null, null], ['b', null, null]]);
});

test('cards of teams that are not entries are ignored', () => {
  const result = computeResults(config, entries('a'), [card('a', 2), card('removed', 5, { nominations: ['wow'] })]);
  assert.equal(result.ranking.length, 1);
  assert.ok(!Object.values(winners(result)).includes('removed'));
});

test('overall ties are broken by technical, full ties share a rank', () => {
  // a and b both total 80; b has technical 5, a has 4
  const b = card('b', 4, { values: { technical: 5, demo: 3, aiMastery: 3 } });
  const result = computeResults(config, entries('a', 'b', 'c', 'd'), [card('a', 4), b, card('c', 4), card('d', 2)]);
  assert.deepEqual(result.ranking.map(team => [team.team, team.rank]), [['b', 1], ['a', 2], ['c', 2], ['d', 4]]);
});

test('equal averages from different juror counts are exact ties', () => {
  const cards = [card('a', 4), ...['j1', 'j2', 'j3'].map(juror => card('b', 4, { juror }))];
  assert.deepEqual(computeResults(config, entries('a', 'b'), cards).ranking.map(team => team.rank), [1, 1]);
});

test('category score is weighted over its criteria and normalized to 100', () => {
  const result = computeResults(only('campusHero'), entries('a'), [card('a', 1, { values: { problemFit: 5, impact: 3 } })]);
  // (15×5 + 10×3) / (25×5) × 100
  assert.equal(result.categories[0].top[0].score, 84);
});

test('categories follow priority, not array order', () => {
  const categories = [...DEFAULT_CATEGORIES].reverse();
  const result = computeResults({ ...config, categories }, entries('a'), [card('a', 5)]);
  assert.deepEqual(result.categories.map(category => category.priority), [1, 2, 3, 4, 5]);
  assert.equal(result.categories[0].winner, 'a');
});

test('a team gets at most one award', () => {
  const all = DEFAULT_CATEGORIES.map(category => category.key);
  const result = computeResults(config, entries('a', 'b', 'c'), [card('a', 5, { nominations: all }), card('b', 4), card('c', 3)]);
  assert.deepEqual(winners(result), { campusHero: 'a', wow: 'b', demoGod: 'c', pilot: null, dreamTeam: null });
  assert.equal(result.categories[3].reason, 'NO_TEAM');
  assert.equal(result.categories[4].reason, 'NO_NOMINATION');
});

test('nominated teams beat a higher scored team without nomination', () => {
  const [wow] = computeResults(only('wow'), entries('a', 'b'), [card('a', 5), card('b', 2, { nominations: ['wow'] })]).categories;
  assert.equal(wow.winner, 'b');
  assert.equal(wow.basis, 'NOMINATIONS');
  assert.equal(wow.top.length, 1);
});

test('an empty pool falls back to every scored team', () => {
  const [wow] = computeResults(only('wow'), entries('a', 'b', 'c'), [card('a', 3), card('b', 4)]).categories;
  assert.equal(wow.winner, 'b');
  assert.equal(wow.basis, 'ALL_SCORED');
  assert.deepEqual(wow.top.map(candidate => candidate.team), ['b', 'a']);
});

test('the pool is also empty when every nominee already has an award', () => {
  const result = computeResults(only('campusHero', 'wow'), entries('a', 'b'), [card('a', 5, { nominations: ['campusHero', 'wow'] }), card('b', 2)]);
  assert.deepEqual(winners(result), { campusHero: 'a', wow: 'b' });
  assert.equal(result.categories[1].basis, 'ALL_SCORED');
  assert.deepEqual(result.categories[1].awardedNominees, ['a']);
});

test('tie break 1: category score beats nomination count', () => {
  const cards = [card('a', 3, { nominations: ['wow'] }), card('a', 3, { juror: 'j2', nominations: ['wow'] }),
    card('b', 3, { values: { originality: 4 }, nominations: ['wow'] })];
  assert.equal(computeResults(only('wow'), entries('a', 'b'), cards).categories[0].winner, 'b');
});

test('tie break 2: nomination count beats overall score', () => {
  const values = { originality: 4 };
  const cards = [card('a', 5, { values, nominations: ['wow'] }), card('b', 2, { values, nominations: ['wow'] }),
    card('b', 2, { juror: 'j2', values, nominations: ['wow'] })];
  assert.equal(computeResults(only('wow'), entries('a', 'b'), cards).categories[0].winner, 'b');
});

test('tie break 3: overall score', () => {
  const values = { originality: 4 };
  const cards = [card('a', 2, { values }), card('b', 3, { values })];
  assert.equal(computeResults(only('wow'), entries('a', 'b'), cards).categories[0].winner, 'b');
});

test('tie break 4: technical score', () => {
  const cards = [card('a', 4), card('b', 4, { values: { technical: 5, demo: 3, aiMastery: 3 } })];
  const [wow] = computeResults(only('wow'), entries('a', 'b'), cards).categories;
  assert.equal(wow.winner, 'b');
  assert.equal(wow.tie, false);
});

test('a full tie is flagged and listed in presentation order', () => {
  const [wow] = computeResults(only('wow'), entries('a', 'b'), [card('b', 4), card('a', 4)]).categories;
  assert.equal(wow.winner, 'a');
  assert.equal(wow.tie, true);
});

test('at most three candidates are returned', () => {
  const teams = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(computeResults(only('wow'), entries(...teams), teams.map(team => card(team, 3))).categories[0].top.length, 3);
});

test('Dream Team ranks by nominations, then overall score', () => {
  const nominations = ['dreamTeam'];
  const more = [card('a', 5, { nominations }), card('b', 2, { nominations }), card('b', 2, { juror: 'j2', nominations })];
  assert.equal(computeResults(only('dreamTeam'), entries('a', 'b'), more).categories[0].winner, 'b');
  const tied = [card('a', 3, { nominations }), card('b', 4, { nominations })];
  assert.equal(computeResults(only('dreamTeam'), entries('a', 'b'), tied).categories[0].winner, 'b');
});

test('categories without criteria give no suggestion when nobody is nominated', () => {
  const custom = { key: 'rubberDuck', name: 'Rubber Duck', criterionKeys: [], priority: 9, active: true };
  const result = computeResults({ ...config, categories: [DEFAULT_CATEGORIES[4], custom] }, entries('a', 'b'), [card('a', 5), card('b', 3)]);
  for (const category of result.categories) {
    assert.equal(category.winner, null);
    assert.equal(category.reason, 'NO_NOMINATION');
    assert.deepEqual(category.top, []);
  }
});

test('categories without criteria give no suggestion when the only nominee already has an award', () => {
  const result = computeResults(only('wow', 'dreamTeam'), entries('a', 'b'), [card('a', 5, { nominations: ['wow', 'dreamTeam'] }), card('b', 4)]);
  assert.deepEqual(winners(result), { wow: 'a', dreamTeam: null });
  assert.deepEqual(result.categories[1].awardedNominees, ['a']);
});

test('inactive categories neither appear nor consume an award', () => {
  const categories = DEFAULT_CATEGORIES.map(category => ({ ...category, active: category.key !== 'campusHero' }));
  const result = computeResults({ ...config, categories }, entries('a'), [card('a', 5, { nominations: ['campusHero'] })]);
  assert.equal(result.categories.length, 4);
  assert.equal(result.categories[0].winner, 'a');
});

test('no entries or no cards is a valid, empty result', () => {
  assert.deepEqual(computeResults(config, [], []).ranking, []);
  assert.ok(computeResults(config, entries('a'), []).categories.every(category => category.winner === null));
});
