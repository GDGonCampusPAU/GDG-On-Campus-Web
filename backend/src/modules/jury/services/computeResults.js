// Pure scoring rules (docs/JURI_PUANLAMA_SPEC.md §4). No database access.
//
// Every average is computed as "integer sum / integer" in one division on purpose: equal
// averages then give identical doubles, so the tie-break chain never loses to rounding noise.

/**
 * @typedef {{ key: string, weight: number }} Criterion
 * @typedef {{ key: string, name: string, icon?: string, criterionKeys: string[], priority: number, active: boolean }} Category
 * @typedef {{ team: any, order: number }} Entry
 * @typedef {{ team: any, status: string, scores: { criterion: string, value?: number | null }[], nominations: string[] }} Card
 * @typedef {{ team: any, scores: { criterion: string, value: number }[] }} Vote
 */

const TOP_COUNT = 3;
const TIE_BREAK_CRITERION = 'technical';
// Final score (revizyon §4): jury 70%, participants 30%.
const JURY_SHARE = 0.7;
const PARTICIPANT_SHARE = 0.3;
// Awards are shared among the top of the final ranking (revizyon §5: "ilk 5").
const AWARD_POOL = 5;

/** Descending; null sorts last. @param {number | null} a @param {number | null} b */
const desc = (a, b) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
};

/** First non-zero comparison wins. @param {((a: any, b: any) => number)[]} steps */
const chain = (...steps) => (a, b) => {
  for (const step of steps) {
    const result = step(a, b);
    if (result) return result;
  }
  return 0;
};

/**
 * Juror total on a 0-100 scale: Σ weight × (value / 5).
 * @param {Criterion[]} criteria @param {Card['scores']} scores
 */
const cardTotal = (criteria, scores) => {
  const values = new Map(scores.map(score => [score.criterion, score.value ?? 0]));
  return criteria.reduce((sum, criterion) => sum + criterion.weight * (values.get(criterion.key) ?? 0), 0) / 5;
};

/** @param {Criterion[]} criteria @param {Entry} entry @param {Card[]} cards submitted cards of this team */
const summarize = (criteria, entry, cards) => {
  const sums = new Map(criteria.map(criterion => [criterion.key, 0]));
  const nominations = new Map();
  for (const card of cards) {
    for (const score of card.scores) {
      if (sums.has(score.criterion)) sums.set(score.criterion, sums.get(score.criterion) + (score.value ?? 0));
    }
    for (const key of new Set(card.nominations)) nominations.set(key, (nominations.get(key) ?? 0) + 1);
  }

  const judgeCount = cards.length;
  const weighted = list => list.reduce((sum, criterion) => sum + criterion.weight * sums.get(criterion.key), 0);
  return {
    team: String(entry.team),
    order: entry.order,
    judgeCount,
    overall: judgeCount ? weighted(criteria) / (5 * judgeCount) : null,
    technical: judgeCount && sums.has(TIE_BREAK_CRITERION) ? sums.get(TIE_BREAK_CRITERION) / judgeCount : null,
    criterionAverages: Object.fromEntries(criteria.map(({ key }) => [key, judgeCount ? sums.get(key) / judgeCount : null])),
    nominations,
    /** Weighted score over some criteria, normalized to 0-100. @param {Criterion[]} list */
    scoreFor: list => {
      const weight = list.reduce((sum, criterion) => sum + criterion.weight, 0);
      return judgeCount && weight ? (20 * weighted(list)) / (weight * judgeCount) : null;
    }
  };
};

/**
 * Participant score on a 0-100 scale: per-criterion average of the votes, weighted like the jury's.
 * Every vote counts once, so a team with fewer voters is not at a disadvantage (revizyon §3).
 * @param {Criterion[]} criteria @param {Vote[]} votes
 */
const participantSummary = (criteria, votes) => {
  const sums = new Map(criteria.map(criterion => [criterion.key, 0]));
  for (const vote of votes) {
    for (const score of vote.scores) if (sums.has(score.criterion)) sums.set(score.criterion, sums.get(score.criterion) + score.value);
  }
  const count = votes.length;
  return {
    participantCount: count,
    participantScore: count ? criteria.reduce((sum, criterion) => sum + criterion.weight * sums.get(criterion.key), 0) / (5 * count) : null,
    participantAverages: Object.fromEntries(criteria.map(({ key }) => [key, count ? sums.get(key) / count : null]))
  };
};

/**
 * Final = jury × 0.7 + participants × 0.3. Without any participant vote the jury score alone is used
 * (and flagged), so a team is not cut by 30% because the hall did not vote for it.
 */
const finalOf = (overall, participantScore) => {
  if (overall === null) return null;
  return participantScore === null ? overall : JURY_SHARE * overall + PARTICIPANT_SHARE * participantScore;
};

/**
 * Suggests a winner for one category among the teams that have no award yet.
 * - Only nominated teams compete. Without an eligible nominee there is no suggestion and the jury
 *   decides (organizer decision, overrides the fallback in spec §4.5).
 * - With ranking criteria the category score ranks the nominees; without (e.g. Dream Team) the
 *   number of nominations does.
 * @param {Category} category @param {Criterion[]} criteria @param {ReturnType<typeof summarize>[]} available
 * @param {string[]} awardedNominees nominees left out because they already have an award
 * @param {boolean} anyScored whether any team has a submitted card
 * @param {boolean} nominatedAnywhere whether any juror nominated any team for this category
 */
const suggest = (category, criteria, available, awardedNominees, anyScored, nominatedAnywhere) => {
  const ranked = criteria.filter(criterion => category.criterionKeys.includes(criterion.key));
  const candidates = available.map(team => ({
    team: team.team,
    order: team.order,
    score: team.scoreFor(ranked),
    nominationCount: team.nominations.get(category.key) ?? 0,
    overall: team.overall,
    technical: team.technical
  }));
  const nominated = candidates.filter(candidate => candidate.nominationCount > 0);
  const base = { key: category.key, name: category.name, icon: category.icon ?? '', priority: category.priority, criterionKeys: category.criterionKeys, awardedNominees };
  const none = reason => ({ ...base, winner: null, reason, tie: false, top: [] });

  if (!nominated.length) {
    if (!anyScored) return none('NO_TEAM');
    // Nobody nominated anyone: say so, not "no eligible nominee left" (which suggests awards took them).
    return none(nominatedAnywhere || awardedNominees.length ? 'NO_ELIGIBLE_NOMINEE' : 'NO_NOMINATION');
  }

  const compare = ranked.length
    ? chain((a, b) => desc(a.score, b.score), (a, b) => b.nominationCount - a.nominationCount, (a, b) => desc(a.overall, b.overall), (a, b) => desc(a.technical, b.technical))
    : chain((a, b) => b.nominationCount - a.nominationCount, (a, b) => desc(a.overall, b.overall));
  const pool = nominated.sort(chain(compare, (a, b) => a.order - b.order));

  return {
    ...base,
    winner: pool[0].team,
    reason: null,
    // A full tie is listed in presentation order, and the screen asks the jury to decide.
    tie: pool.length > 1 && compare(pool[0], pool[1]) === 0,
    top: pool.slice(0, TOP_COUNT)
  };
};

/**
 * @param {{ criteria: Criterion[], categories: Category[] }} config
 * @param {Entry[]} entries competing teams
 * @param {Card[]} scorecards cards of any status; only SUBMITTED ones count
 * @param {Vote[]} [votes] participant votes
 */
const computeResults = (config, entries, scorecards, votes = []) => {
  const { criteria } = config;
  /** @type {Map<string, Card[]>} */
  const cardsByTeam = new Map(entries.map(entry => [String(entry.team), []]));
  for (const card of scorecards) {
    if (card.status === 'SUBMITTED') cardsByTeam.get(String(card.team))?.push(card);
  }
  /** @type {Map<string, Vote[]>} */
  const votesByTeam = new Map(entries.map(entry => [String(entry.team), []]));
  for (const vote of votes) votesByTeam.get(String(vote.team))?.push(vote);
  const teams = entries.map(entry => {
    const jury = summarize(criteria, entry, cardsByTeam.get(String(entry.team)));
    const crowd = participantSummary(criteria, votesByTeam.get(String(entry.team)));
    return { ...jury, ...crowd, final: finalOf(jury.overall, crowd.participantScore) };
  });

  // Ranked by the final score; ties fall back to the jury score, then the technical criterion.
  const byScore = chain((a, b) => desc(a.final, b.final), (a, b) => desc(a.overall, b.overall), (a, b) => desc(a.technical, b.technical));
  const sorted = [...teams].sort(chain(byScore, (a, b) => a.order - b.order));
  let rank = 0;
  const ranking = sorted.map(({ nominations, scoreFor: _scoreFor, ...team }, index) => {
    // Full ties share a rank (1, 1, 3).
    if (index === 0 || byScore(sorted[index - 1], team) !== 0) rank = index + 1;
    return { ...team, rank: team.judgeCount ? rank : null, nominationCounts: Object.fromEntries(nominations) };
  });

  // Awards go to the top 5 of the final ranking, one per team (revizyon §5). A category whose nominees
  // are all outside them asks for a jury decision.
  const active = config.categories.filter(category => category.active).sort((a, b) => a.priority - b.priority);
  const anyScored = teams.some(team => team.judgeCount);
  const top = new Set(sorted.filter(team => team.judgeCount).slice(0, AWARD_POOL).map(team => team.team));
  const awarded = new Set();
  const categories = active
    .map(category => {
      const scored = teams.filter(team => team.judgeCount && top.has(team.team));
      const nominatedAnywhere = teams.some(team => team.judgeCount && team.nominations.has(category.key));
      const awardedNominees = scored.filter(team => awarded.has(team.team) && team.nominations.has(category.key)).map(team => team.team);
      const result = suggest(category, criteria, scored.filter(team => !awarded.has(team.team)), awardedNominees, anyScored, nominatedAnywhere);
      if (result.winner) awarded.add(result.winner);
      return result;
    });

  return { ranking, categories, awardPool: [...top] };
};

module.exports = { computeResults, cardTotal, JURY_SHARE, PARTICIPANT_SHARE };
