// No exported cell may start a formula, whichever delimiter the spreadsheet uses to open the file
// (Excel picks `;` or `,` from the Windows regional settings).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-team-secret-never-use-in-production';
process.env.PARTICIPANT_JWT_SECRET = 'test-participant-secret-never-use-in-production';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const { escapeCsvCell } = require('../src/utils/query');
const app = require('../src/app');
const User = require('../src/models/User');
const Form = require('../src/models/Form');
const FormResponse = require('../src/models/FormResponse');
const { generateToken } = require('../src/utils/jwt');

let repl;
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  await mongoose.connect(repl.getUri());
});
after(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });

/** Splits like a spreadsheet: a quote opens a quoted part only at the start of a cell. */
const cellsOf = (text, delimiter) => {
  const cells = [];
  let cell = '';
  let quoted = false;
  let atStart = true;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (atStart && char === '"') {
      quoted = true;
      atStart = false;
    } else if (char === delimiter || char === '\r' || char === '\n') {
      cells.push(cell);
      cell = '';
      atStart = true;
    } else {
      cell += char;
      atStart = false;
    }
  }
  cells.push(cell);
  return cells;
};
const DELIMITERS = [',', ';', '\t'];
const formulasIn = text => DELIMITERS.flatMap(delimiter => cellsOf(text, delimiter).filter(cell => /^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/.test(cell)));
const file = (rows, delimiter) => `${rows.map(row => row.map(escapeCsvCell).join(delimiter)).join('\r\n')}\r\n`;

const PAYLOADS = ['=1+1', 'Takim;=1+1;', 'Takim,=1+1,', 'a\t=1+1', 'a\n=1+1', 'a\r=1+1', 'a; =1+1', 'a;"=1+1"', 'a,""=1+1', 'a;@SUM(1)', 'a,-2+3', 'a;+90', '＝1+1', 'a;＝1+1'];
for (const payload of PAYLOADS) {
  test(`no formula cell from ${JSON.stringify(payload)}`, () => {
    for (const delimiter of [',', ';']) assert.deepEqual(formulasIn(file([['id', payload, 'son']], delimiter)), []);
  });
}

test('no formula cell from random hostile text', () => {
  const alphabet = ['=', '+', '-', '@', ',', ';', '"', "'", ' ', '\t', '\r', '\n', 'a', '1', '＝'];
  let seed = 7;
  const random = max => {
    seed = (seed * 16807) % 2147483647;
    return seed % max;
  };
  const cell = () => Array.from({ length: random(9) }, () => alphabet[random(alphabet.length)]).join('');
  for (let round = 0; round < 50000; round += 1) {
    const rows = [[cell(), cell(), cell()], [cell(), cell(), cell()]];
    for (const delimiter of [',', ';']) {
      const found = formulasIn(file(rows, delimiter));
      if (found.length) assert.fail(`${JSON.stringify(rows)} with "${delimiter}" -> ${JSON.stringify(found[0])}`);
    }
  }
});

test('ordinary text is left unchanged', () => {
  for (const text of ['Kod Kervanı', 'a, b; c', 'e-posta', 'C++ ve C#', 'ayse@example.com', '1+1 = 2', 'Satır 1\nSatır 2', "Ayşe'nin takımı"]) {
    assert.equal(escapeCsvCell(text), `"${text}"`);
  }
});

test('a hostile team name stays text in the applications export', async () => {
  const staff = await User.create({ fullName: 'Staff', email: 'staff@pau.edu.tr', passwordHash: 'x', role: 'ORGANIZER', isEmailVerified: true });
  const form = await Form.create({ title: 'Hackathon', slug: 'csv-safety', fields: [] });
  await FormResponse.create({ form: form._id, formSlug: form.slug, teamName: 'Takim;=1+1;', answers: [] });
  const res = await request(app).get(`/api/v1/forms/${form._id}/responses/export`).set('Authorization', `Bearer ${generateToken({ id: staff._id, role: 'ORGANIZER' })}`);
  assert.equal(res.status, 200);
  assert.deepEqual(formulasIn(res.text.replace(/^﻿/, '')), []);
});
