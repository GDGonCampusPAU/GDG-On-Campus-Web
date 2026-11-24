// GitHub repo links accepted by the project upload site.
// Only github.com/<owner>/<repo>; the canonical form drops ".git", trailing slashes, query and path parts
// after the repo (…/tree/main, …/commits), so the same repo always gets the same key.
// The same rules live in the upload site (hackaton-proje-yukleme/backend/src/repoUrl.js); keep them in sync.

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * @param {unknown} input
 * @returns {{ owner: string, repo: string, url: string, key: string } | null}
 */
const parseRepoUrl = (input) => {
  if (typeof input !== 'string') return null;
  let text = input.trim();
  if (!text || text.length > 300) return null;
  if (!/^[a-z]+:\/\//i.test(text)) text = `https://${text}`;
  let url;
  try { url = new URL(text); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return null;
  const [owner, rawRepo] = url.pathname.split('/').filter(Boolean);
  if (!owner || !rawRepo) return null;
  const repo = rawRepo.replace(/\.git$/i, '');
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === '.' || repo === '..') return null;
  return { owner, repo, url: `https://github.com/${owner}/${repo}`, key: `${owner}/${repo}`.toLowerCase() };
};

module.exports = { parseRepoUrl };
