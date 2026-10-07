function healthCheck(_req, res) {
  res.json({ result: 'i m alive' });
}

module.exports = { healthCheck };
