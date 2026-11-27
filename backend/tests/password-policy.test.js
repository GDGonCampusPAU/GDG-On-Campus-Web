// Registration and reset use the same minimum password length.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRegisterInput } = require('../src/utils/validators');

const errors = password => validateRegisterInput({ fullName: 'Ayşe Yılmaz', email: 'ayse@gmail.com', password });

test('registration refuses passwords shorter than 8 characters', () => {
  for (const password of ['123456', '1234567']) assert.match(errors(password).join(' '), /en az 8/);
});

test('registration accepts 8 characters', () => {
  assert.deepEqual(errors('12345678'), []);
});
