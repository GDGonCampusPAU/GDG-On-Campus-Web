// Late-push check (jury admin > Teslim kontrolü): which teams pushed to their repo after the deadline.
//
// Commit dates come from the team's computer and can be set to anything (git commit --date), so they
// prove nothing. GitHub's repository activity list records when each push (or force push) reached
// GitHub, and the team cannot change that. The deadline is the moment an admin pressed "Proje yüklemeyi
// kapat" (form.settings.projectUploadClosedAt); the screen can check against another moment too.
//
// Only public repos are accepted by the upload site, so the activity list is readable with any token.
// GITHUB_TOKEN (read-only, no scopes) raises GitHub's limit from 60 to 5000 requests an hour; without it
// the check still works for a few runs. Each repo is asked at most once per CACHE_MS.
const Form = require('../../../models/Form');
const EventPage = require('../../../models/EventPage');
const HackathonTeam = require('../../../models/HackathonTeam');
const ProjectSubmission = require('../models/ProjectSubmission');
const JudgingConfig = require('../../jury/models/JudgingConfig');
const { juryError } = require('../../jury/services/juryError');
const { parseRepoUrl } = require('./repoUrl');

const FORM_SLUG = 'hackathon-katilim';
const API = 'https://api.github.com';
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const CACHE_MS = 60 * 1000;
const PARALLEL = 4;
// Team pages (juror, upload site) wait for GitHub at most this long.
const QUICK_MS = 4000;
const SHOWN = 20;
// Activities that bring code in. Deleting a branch adds nothing.
const CODE_IN = new Set(['push', 'force_push', 'pr_merge', 'merge_queue_merge', 'branch_creation']);
const ZERO_SHA = /^0+$/;

// juryError: the jury admin routes show these as { code, message } (controllers/respond.js).
const failure = juryError;

const nextLink = (header) => /<([^>]+)>;\s*rel="next"/.exec(header || '')?.[1] || null;

/**
 * @param {{ fetch?: typeof fetch, token?: string, now?: () => number, cacheMs?: number }} [options]
 */
const createLatePushChecker = ({ fetch: doFetch = (url, init) => fetch(url, init), token = process.env.GITHUB_TOKEN || '', now = Date.now, cacheMs = CACHE_MS } = {}) => {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gdg-pau-late-push-check',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  /** @type {Map<string, { at: number, value: any }>} */
  const cache = new Map();

  /** @typedef {{ status: 'OK' | 'REPO_GONE' | 'UNAVAILABLE', items: any[], truncated: boolean }} Activity */
  /** Newest first; at most MAX_PAGES pages. @returns {Promise<Activity>} */
  const activity = async (owner, repo) => {
    const key = `${owner}/${repo}`.toLowerCase();
    const hit = cache.get(key);
    if (hit && now() - hit.at < cacheMs) return hit.value;
    let url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/activity?per_page=${PAGE_SIZE}`;
    const items = [];
    /** @type {Activity | undefined} */
    let value;
    try {
      for (let page = 0; url && page < MAX_PAGES; page += 1) {
        const res = await doFetch(url, { headers, signal: AbortSignal.timeout(10000) });
        if (res.status === 404 || res.status === 451) { value = { status: 'REPO_GONE', items: [], truncated: false }; break; }
        if (!res.ok) { value = { status: 'UNAVAILABLE', items: [], truncated: false }; break; }
        const list = await res.json();
        items.push(...(Array.isArray(list) ? list : []));
        url = nextLink(res.headers.get('link'));
      }
      value ||= { status: 'OK', items, truncated: Boolean(url) };
    } catch {
      value = { status: 'UNAVAILABLE', items: [], truncated: false };
    }
    // A failure is not kept: the next check asks again.
    if (value.status !== 'UNAVAILABLE') cache.set(key, { at: now(), value });
    return value;
  };

  const shape = (item, repoUrl) => {
    const after = String(item.after || '');
    const before = String(item.before || '');
    return {
      at: new Date(item.timestamp).toISOString(),
      type: item.activity_type,
      actor: item.actor?.login || '',
      ref: String(item.ref || '').replace(/^refs\/heads\//, ''),
      url: before && !ZERO_SHA.test(before) && after ? `${repoUrl}/compare/${before.slice(0, 12)}...${after.slice(0, 12)}`
        : after ? `${repoUrl}/commit/${after}` : repoUrl
    };
  };

  /** One team's verdict. */
  const checkTeam = async ({ team, teamName, repoUrl }, deadline, startsAt) => {
    const base = { team: String(team), teamName, repoUrl: repoUrl || null };
    const repo = parseRepoUrl(repoUrl);
    if (!repo) return { ...base, status: 'NO_REPO', latePushes: [], lateCount: 0, forcedLate: false, earlyCount: 0, lastPushAt: null, truncated: false };
    const { status, items, truncated } = await activity(repo.owner, repo.repo);
    const code = items.filter(item => CODE_IN.has(item.activity_type) && Number.isFinite(Date.parse(item.timestamp)));
    const late = deadline ? code.filter(item => Date.parse(item.timestamp) > deadline) : [];
    const early = startsAt ? code.filter(item => Date.parse(item.timestamp) < startsAt) : [];
    return {
      ...base,
      repoUrl: repo.url,
      status: status !== 'OK' ? status : late.length ? 'LATE' : 'ON_TIME',
      lateCount: late.length,
      forcedLate: late.some(item => item.activity_type === 'force_push'),
      latePushes: late.slice(0, SHOWN).map(item => shape(item, repo.url)),
      earlyCount: early.length,
      lastPushAt: code[0] ? new Date(code[0].timestamp).toISOString() : null,
      // More activity than was read: older pushes (e.g. before the event) may be missing.
      truncated
    };
  };

  /** Runs fn over items, PARALLEL at a time, keeping the order. */
  const pool = async (items, fn) => {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
      while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
    }));
    return out;
  };

  /**
   * Every competing team and every team with a link.
   * @param {{ deadline?: unknown }} [query] deadline: ISO time to check against instead of the closing moment
   */
  const report = async (query = {}) => {
    const form = await Form.findOne({ slug: FORM_SLUG }).select('settings').lean();
    if (!form) throw failure(404, 'Hackathon formu bulunamadı.', 'FORM_NOT_FOUND');
    const settings = /** @type {any} */ (form).settings || {};
    const closedAt = settings.projectUploadEnabled === false && settings.projectUploadClosedAt ? new Date(settings.projectUploadClosedAt) : null;
    let deadline = closedAt;
    let source = closedAt ? 'CLOSED_AT' : 'NONE';
    if (query.deadline !== undefined && query.deadline !== '') {
      const custom = new Date(String(query.deadline));
      if (!Number.isFinite(custom.getTime())) throw failure(400, 'Teslim zamanı geçerli bir tarih olmalı.', 'INVALID_DEADLINE');
      deadline = custom;
      source = 'CUSTOM';
    }
    const page = await EventPage.findById('hackathon').select('event.startsAt').lean();
    const startsAt = Date.parse(/** @type {any} */ (page)?.event?.startsAt) || null;

    const [config, submissions] = await Promise.all([
      JudgingConfig.findById(JudgingConfig.CONFIG_ID).select('entries').lean(),
      ProjectSubmission.find({ form: form._id }).select('team repoUrl').lean()
    ]);
    const entries = /** @type {any} */ (config)?.entries || [];
    const linkOf = new Map(submissions.map(s => [String(s.team), s.repoUrl]));
    const ids = [...new Set([...entries.map(e => String(e.team)), ...linkOf.keys()])];
    const teams = await HackathonTeam.find({ _id: { $in: ids } }).select('name').lean();
    const nameOf = new Map(teams.map(t => [String(t._id), t.name]));
    const competing = new Set(entries.map(e => String(e.team)));
    const order = new Map(entries.map(e => [String(e.team), e.order]));
    // Competing teams in their setup order first, then the others by name. A link typed by the admin
    // on "Yarışan takımlar" wins over the uploaded one, as on the jury screen.
    const rows = ids.filter(id => nameOf.has(id) || competing.has(id)).map(id => ({
      team: id,
      teamName: nameOf.get(id) || entries.find(e => String(e.team) === id)?.teamName || 'Silinmiş takım',
      repoUrl: entries.find(e => String(e.team) === id)?.repoUrl || linkOf.get(id) || '',
      competing: competing.has(id)
    })).sort((a, b) => (Number(b.competing) - Number(a.competing)) || ((order.get(a.team) ?? 0) - (order.get(b.team) ?? 0)) || a.teamName.localeCompare(b.teamName, 'tr'));

    const time = deadline ? deadline.getTime() : null;
    const checked = await pool(rows, row => checkTeam(row, time, startsAt));
    return {
      deadline: deadline ? deadline.toISOString() : null,
      deadlineSource: source,
      closedAt: closedAt ? closedAt.toISOString() : null,
      uploadOpen: settings.projectUploadEnabled !== false,
      eventStartsAt: startsAt ? new Date(startsAt).toISOString() : null,
      checkedAt: new Date(now()).toISOString(),
      authenticated: Boolean(token),
      teams: checked.map((row, i) => ({ ...row, competing: rows[i].competing })),
      summary: {
        late: checked.filter(row => row.status === 'LATE').length,
        forced: checked.filter(row => row.forcedLate).length,
        unavailable: checked.filter(row => row.status === 'UNAVAILABLE' || row.status === 'REPO_GONE').length,
        noRepo: checked.filter(row => row.status === 'NO_REPO').length
      }
    };
  };

  /** The deadline in force: the moment project upload was closed (null while open). */
  const closingMoment = async () => {
    const form = await Form.findOne({ slug: FORM_SLUG }).select('settings').lean();
    const settings = /** @type {any} */ (form)?.settings || {};
    return settings.projectUploadEnabled === false && settings.projectUploadClosedAt ? new Date(settings.projectUploadClosedAt) : null;
  };

  /**
   * One team's late pushes, for the juror's team page and the upload site. Never slows those pages
   * down: after QUICK_MS the answer is UNAVAILABLE (the GitHub call goes on and fills the cache).
   * null while project upload is open or the team has no link.
   * @param {string} repoUrl
   * @returns {Promise<null | { deadline: string, status: string, lateCount: number, forcedLate: boolean, latePushes: any[], headsAtDeadline: string[] }>}
   */
  const forTeam = async (repoUrl) => {
    const repo = parseRepoUrl(repoUrl);
    if (!repo) return null;
    const deadline = await closingMoment();
    if (!deadline) return null;
    const time = deadline.getTime();
    const read = activity(repo.owner, repo.repo);
    const timeout = new Promise(resolve => { setTimeout(() => resolve(null), QUICK_MS).unref?.(); });
    const result = /** @type {Awaited<ReturnType<typeof activity>> | null} */ (await Promise.race([read, timeout]));
    const base = { deadline: deadline.toISOString(), lateCount: 0, forcedLate: false, latePushes: [], headsAtDeadline: [] };
    if (!result || result.status !== 'OK') return { ...base, status: result?.status || 'UNAVAILABLE' };
    const code = result.items.filter(item => CODE_IN.has(item.activity_type) && Number.isFinite(Date.parse(item.timestamp)));
    const late = code.filter(item => Date.parse(item.timestamp) > time);
    // Branch heads at the deadline: every commit newer than these on the branch came in late.
    const heads = new Map();
    for (const item of code) {
      if (Date.parse(item.timestamp) <= time && !heads.has(item.ref) && item.after) heads.set(item.ref, String(item.after));
    }
    return {
      ...base,
      status: late.length ? 'LATE' : 'ON_TIME',
      lateCount: late.length,
      forcedLate: late.some(item => item.activity_type === 'force_push'),
      latePushes: late.slice(0, SHOWN).map(item => ({ ...shape(item, repo.url), sha: String(item.after || '') })),
      headsAtDeadline: [...heads.values()]
    };
  };

  return { report, forTeam, activity, cache };
};

const checker = createLatePushChecker();

module.exports = { createLatePushChecker, report: (query) => checker.report(query), forTeam: (repoUrl) => checker.forTeam(repoUrl), CODE_IN };
