// Golden values measured on the original shipped build (dist 4482dc0b881d) before the source was
// restored. They pin the restored code to the original behaviour; change them only on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BUILDERS, huntRun, mapHash } from './helpers.js';

const GOLDEN_MAPS = { town: '683262f5', forest: '3740ef5d', mine: 'dc4dbd8c', orc: 'eeaf1cee', mine2: '9d0fb253' };

test('map generation matches the original build', () => {
  for (const [id, hash] of Object.entries(GOLDEN_MAPS)) assert.equal(mapHash(MAP_BUILDERS[id]()), hash, id);
});

test('seeded hunting run matches the original build', () => {
  assert.equal(huntRun(4242, 20000).hash, 'b181039b');
});
