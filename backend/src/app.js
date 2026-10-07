const express = require('express');
const testRouter = require('./routes/test.routes');

const app = express();

app.use(express.json());
app.use('/api/test', testRouter);

module.exports = app;
