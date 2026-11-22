// Jüri linki ve jüri yönetimi etkinlik içeriğini kullanmaz (bkz. main.jsx).
/** @param {string} pathname */
export const needsEventData = (pathname) => !/^\/(juri\/|admin\/juri(\/|$))/i.test(pathname)
