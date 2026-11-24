const express = require('express');

/**
 * The jury routers run before the app-wide body parser, so that only authenticated requests get parsed.
 * @type {import('express').RequestHandler}
 */
const objectBody = (req, res, next) => {
  if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.status(400).json({ success: false, message: 'İstek gövdesi JSON nesnesi olmalıdır.' });
  }
  req.body ||= {};
  next();
};

/** Nothing may fall through to the rest of the app with the general limiter not yet applied. @type {import('express').RequestHandler} */
const notFound = (req, res) => res.status(404).json({ success: false, message: `İstenen kaynak bulunamadı: ${req.method} ${req.originalUrl}` });

module.exports = { parseBody: [express.json({ limit: '1mb' }), objectBody], notFound };
