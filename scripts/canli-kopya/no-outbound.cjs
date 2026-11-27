// node --require ile yüklenir: bu süreçten hiçbir istek bilgisayarın dışına çıkmaz.
// api.github.com → yerel sahte GitHub (GDG_KOPYA_GITHUB, varsayılan 127.0.0.1:5199); localhost dışı her şey engellenir.
const realFetch = globalThis.fetch;
const github = process.env.GDG_KOPYA_GITHUB || 'http://127.0.0.1:5199';
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.hostname === 'api.github.com') return realFetch(`${github}${url.pathname}${url.search}`, init);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    console.error(`[ENGELLENDİ] dışarı istek: ${url.origin}`);
    throw new Error(`Dışarı istek engellendi: ${url.origin}`);
  }
  return realFetch(input, init);
};
