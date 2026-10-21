const write = (res, chunk) => {
  if (res.destroyed) throw new Error('İndirme bağlantısı kapandı.');
  if (res.write(chunk)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => { res.off('drain', drained); res.off('close', closed); };
    const drained = () => { cleanup(); resolve(); };
    const closed = () => { cleanup(); reject(new Error('İndirme bağlantısı kapandı.')); };
    res.once('drain', drained); res.once('close', closed);
  });
};
const streamJson = async (res, cursor) => {
  let separator = '';
  try {
    await write(res, '[');
    for await (const record of cursor) { await write(res, separator + JSON.stringify(record)); separator = ',\n'; }
    res.end(']');
  } finally { await cursor.close(); }
};
module.exports = { write, streamJson };
