import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQualityReview, saveQualityReview, reviewStateKey } from '../src/qualityRepository.ts';

const review = () => ({ schemaVersion: 1, experimentId: 'qa-experiment', beforeStart: '2026-10-01', beforeEnd: '2026-10-04', afterStart: '2026-10-05', afterEnd: '2026-10-08', exclusions: [] });

// Test-only async port wraps real SQLite calls, including a real rollback boundary; no mocked query results.
function open(file) {
  const raw = new DatabaseSync(file);
  const sql = {
    async getFirstAsync(query, ...params) { return raw.prepare(query).get(...params) ?? null; },
    async runAsync(query, ...params) { return raw.prepare(query).run(...params); },
  };
  const client = { ...sql, async withExclusiveTransactionAsync(task) {
    raw.exec('BEGIN IMMEDIATE');
    try { await task(sql); raw.exec('COMMIT'); } catch (error) { raw.exec('ROLLBACK'); throw error; }
  } };
  return { raw, client, close: () => raw.close() };
}

function setup(raw) {
  raw.exec('CREATE TABLE app_state(key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL); CREATE TABLE measurements(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL); CREATE TABLE experiments(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL);');
  raw.prepare('INSERT INTO app_state VALUES (?,?)').run('pro_entitlement', 'true');
  raw.prepare('INSERT INTO measurements VALUES (?,?)').run('legacy-reading', '{"raw":"retain exact original 90kWh"}');
  raw.prepare('INSERT INTO experiments VALUES (?,?)').run('qa-experiment', '{"setting":"original","free-test":"retain"}');
}

// A cold reopen must return the actually written review, never mutate legacy rows to implement exclusion.
test('real SQLite review roundtrip preserves original readings experiments and Pro entitlement', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'waermetakt-quality-')); let db = open(join(directory, 'test.db'));
  try {
    setup(db.raw); assert.equal(await loadQualityReview(db.client, 'qa-experiment'), null);
    const chosen = review(); chosen.exclusions.push({ phase: 'after', date: '2026-10-08', reason: 'Meter reset; original retained' });
    await saveQualityReview(db.client, chosen);
    db.close(); db = open(join(directory, 'test.db'));
    assert.deepEqual(await loadQualityReview(db.client, 'qa-experiment'), chosen);
    assert.equal(db.raw.prepare('SELECT payload FROM measurements WHERE id=?').get('legacy-reading').payload, '{"raw":"retain exact original 90kWh"}');
    assert.equal(db.raw.prepare('SELECT payload FROM experiments WHERE id=?').get('qa-experiment').payload, '{"setting":"original","free-test":"retain"}');
    assert.equal(db.raw.prepare('SELECT value FROM app_state WHERE key=?').get('pro_entitlement').value, 'true');
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

// Even after one successful load, externally replaced invalid bytes cannot be overwritten by Save.
test('malformed future trailing and wrong-experiment review rows remain byte-for-byte intact', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'waermetakt-quality-corrupt-')); const db = open(join(directory, 'test.db'));
  try {
    setup(db.raw); await saveQualityReview(db.client, review());
    assert.notEqual(await loadQualityReview(db.client, 'qa-experiment'), null);
    const key = reviewStateKey('qa-experiment');
    for (const corrupt of ['{bad', JSON.stringify({ ...review(), schemaVersion: 9 }), JSON.stringify(review()) + ' trailing', JSON.stringify({ ...review(), experimentId: 'wrong-experiment' })]) {
      db.raw.prepare('UPDATE app_state SET value=? WHERE key=?').run(corrupt, key);
      await assert.rejects(loadQualityReview(db.client, 'qa-experiment'));
      await assert.rejects(saveQualityReview(db.client, review()));
      assert.equal(db.raw.prepare('SELECT value FROM app_state WHERE key=?').get(key).value, corrupt);
    }
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

// A real SQLite trigger aborts the write: transaction failure must keep the previous review and all legacy rows.
test('real SQL write failure rolls back review replacement and never publishes a successful save', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'waermetakt-quality-failure-')); const db = open(join(directory, 'test.db'));
  try {
    setup(db.raw); await saveQualityReview(db.client, review());
    const key = reviewStateKey('qa-experiment'); const before = db.raw.prepare('SELECT value FROM app_state WHERE key=?').get(key).value;
    db.raw.exec("CREATE TRIGGER reject_quality BEFORE INSERT ON app_state WHEN NEW.key LIKE 'quality_review_v1:%' BEGIN SELECT RAISE(FAIL,'synthetic blocked storage'); END;");
    const changed = review(); changed.exclusions.push({ phase: 'after', date: '2026-10-08', reason: 'Explicit but not durable yet' });
    await assert.rejects(saveQualityReview(db.client, changed));
    assert.equal(db.raw.prepare('SELECT value FROM app_state WHERE key=?').get(key).value, before);
    assert.deepEqual(await loadQualityReview(db.client, 'qa-experiment'), review());
    assert.equal(db.raw.prepare('SELECT value FROM app_state WHERE key=?').get('pro_entitlement').value, 'true');
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM measurements').get().n, 1);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
