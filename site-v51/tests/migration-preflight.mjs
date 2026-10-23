import assert from 'node:assert/strict';
import { auditRows, compareRows } from '../migration/snapshot-transfer.mjs';

const envelope = JSON.stringify({
  alg: 'AES-256-GCM',
  iv: 'abcdefghijklmnop',
  ciphertext: 'A'.repeat(96),
});
const sample = [
  ...['jbfs', 'barba', 'tay', 'igu'].map((id, i) => ({
    id: 'med-data-v1:' + id,
    revision: i + 1,
    payload: envelope,
    updated_at: '2026-10-23T09:00:00.000Z',
  })),
  { id: 'med-craft-mirror-v1:jbfs', revision: 3, payload: '{}',
    updated_at: '2026-10-23T09:00:00.000Z' },
];
const expected = ['jbfs', 'barba', 'tay', 'igu'];
const summary = auditRows(sample, expected);
assert.equal(summary.rowCount, 5);
assert.equal(summary.counts.profiles, 4);
assert.equal(summary.counts.mirrors, 1);
assert.equal(summary.sha256.length, 64);
assert.equal(compareRows(sample, [...sample].reverse(), expected).identical, true);
assert.equal(compareRows(sample, sample.map(x => ({ ...x })), expected).changed.length, 0);
assert.deepEqual(compareRows(sample, sample.slice(1), expected.slice(1)).missing, ['med-data-v1:jbfs']);
assert.deepEqual(compareRows(sample, sample.map((x, i) => i === 0 ? { ...x, revision: 99 } : x), expected).changed,
  ['med-data-v1:jbfs']);
assert.throws(() => auditRows([...sample, sample[0]], expected), /duplicado/);
assert.throws(() => auditRows(sample.slice(1), expected), /ausente/);
assert.throws(() => auditRows(sample.map((x, i) => i === 0 ?
  { ...x, payload: '{"alg":' } : x), expected), /JSON incompleto/);
assert.throws(() => auditRows(sample.map((x, i) => i === 0 ?
  { ...x, payload: x.payload + '[truncated for model]' } : x), expected), /incompleto/);
assert.throws(() => auditRows(sample.map((x, i) => i === 0 ?
  { ...x, payload: JSON.stringify({ ...JSON.parse(x.payload), iv: 'bad' }) } : x), expected),
  /Envelope cifrado/);
console.log('MED JITA D1 migration preflight: completeness, digest, revision and conflict checks OK.');
