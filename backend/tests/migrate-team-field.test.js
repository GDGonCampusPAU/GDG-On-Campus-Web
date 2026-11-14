const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateEvent } = require('../src/utils/migrateTeamField');

const field = (id, kind = 'text') => ({ id, label: id, kind, required: 'no', hint: '', options: [] });
const legacyEvent = () => ({
  register: {
    steps: [
      { title: 'Katılımcı', fields: [field('fullName')] },
      { title: 'Takım durumu', fields: [field('teamName'), field('teamRole', 'select'), field('teammates'), field('note')] },
    ],
  },
});

test('replaces the legacy team questions in place with the single team field', () => {
  const { event, changed } = migrateEvent(legacyEvent());
  assert.equal(changed, true);
  const ids = event.register.steps[1].fields.map(f => f.id);
  assert.deepEqual(ids, ['team', 'note']);
  assert.equal(event.register.steps[1].fields[0].kind, 'team');
  assert.deepEqual(event.register.steps[0], legacyEvent().register.steps[0], 'other steps untouched');
});

test('is idempotent and leaves forms without legacy fields alone', () => {
  const once = migrateEvent(legacyEvent()).event;
  assert.equal(migrateEvent(once).changed, false);
  assert.equal(migrateEvent({ register: { steps: [{ title: 'A', fields: [field('fullName')] }] } }).changed, false);
});
