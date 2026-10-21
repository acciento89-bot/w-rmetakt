import test from 'node:test';
import assert from 'node:assert/strict';
import { assessQualityReview, defaultQualityReview, decodeQualityReview, encodeQualityReview, validateQualityReview } from '../src/experimentQuality.ts';

const review = () => ({ schemaVersion: 1, experimentId: 'qa-experiment', beforeStart: '2026-10-01', beforeEnd: '2026-10-04', afterStart: '2026-10-05', afterEnd: '2026-10-08', exclusions: [] });
const measurement = (id, date, phase, electricityKwh) => ({ id, measuredAt: `${date}T12:00:00.000Z`, phase, electricityKwh, heatKwh: 40, outsideC: 0, roomC: 21, compressorStarts: 8, flowC: 35, returnC: 29, compressorHours: 6, hotWaterKwh: 3 });
const readings = () => [
  ...[1, 2, 3, 4].map((day) => measurement(`b${day}`, `2026-10-0${day}`, 'before', 20)),
  ...[5, 6, 7, 8].map((day, index) => measurement(`a${day}`, `2026-10-0${day}`, 'after', [10, 10, 10, 90][index])),
];

// A mistaken auto-filter would change the independently calculated all-selected -50% to +50%.
test('explicit excluded-day reason changes sensitivity without removing original outlier readings', () => {
  const raw = readings(); const untouched = JSON.stringify(raw);
  raw.forEach(Object.freeze); Object.freeze(raw);
  const all = assessQualityReview(raw, review());
  assert.equal(all.all.change, -50); assert.equal(all.reviewed.change, -50);
  assert.deepEqual(all.unusualIds, ['a8']); assert.equal(all.reviewed.afterDays, 4);
  assert.equal(all.sensitivityPoints, 0);
  const chosen = review(); chosen.exclusions = [{ phase: 'after', date: '2026-10-08', reason: 'Meter reset; retain original reading' }];
  const result = assessQualityReview(raw, chosen);
  assert.equal(result.all.beforeNormalizedMean, 1); assert.equal(result.all.afterNormalizedMean, 1.5);
  assert.equal(result.all.change, -50); assert.equal(result.reviewed.change, 50);
  assert.equal(result.reviewed.beforeNormalizedMean, 1); assert.equal(result.reviewed.afterNormalizedMean, 0.5);
  assert.equal(result.sensitivityPoints, 100);
  assert.equal(result.all.afterCount, 4); assert.equal(result.reviewed.afterCount, 3);
  assert.deepEqual(result.unusualIds, ['a8']);
  const day = result.days.find((item) => item.phase === 'after' && item.date === '2026-10-08');
  assert.equal(day.excluded, true); assert.equal(day.reason, 'Meter reset; retain original reading');
  assert.equal(day.measurements[0].electricityKwh, 90);
  assert.equal(JSON.stringify(raw), untouched);
});

// Counting phase-only rows would pull the two extra values into the existing formula.
test('comparison respects explicit windows and phases and reports actual missing calendar dates', () => {
  const raw = readings().filter((item) => item.id !== 'a7');
  raw.push(measurement('outside-before', '2026-10-20', 'before', 800), measurement('outside-after', '2026-09-01', 'after', 900));
  const result = assessQualityReview(raw, review());
  assert.equal(result.outsideSelectionCount, 2);
  assert.equal(result.all.beforeCount, 4); assert.equal(result.all.afterCount, 3);
  assert.deepEqual(result.missingDates.before, []); assert.deepEqual(result.missingDates.after, ['2026-10-07']);
  assert.equal(result.status, 'review');
  assert.equal(result.days.length, 8);
});

// Duplicated daily records must not silently become an invented daily consumption value.
test('duplicate dates block comparison until their entire phase-day is explicitly excluded', () => {
  const raw = readings(); raw.push(measurement('duplicate-a5', '2026-10-05', 'after', 10));
  const result = assessQualityReview(raw, review());
  assert.deepEqual(result.duplicateDates.after, ['2026-10-05']);
  assert.equal(result.all.change, null); assert.equal(result.reviewed.change, null); assert.equal(result.status, 'insufficient');
  const chosen = review(); chosen.exclusions = [{ phase: 'after', date: '2026-10-05', reason: 'Two unresolved daily entries' }];
  const selected = assessQualityReview(raw, chosen);
  assert.equal(selected.reviewed.afterCount, 3); assert.equal(selected.all.afterCount, 5);
  assert.notEqual(selected.reviewed.change, null);
  assert.equal(selected.days.find((day) => day.phase === 'after' && day.date === '2026-10-05').measurements.length, 2);
});

// An invalid selected value cannot be discarded to make a result look better.
test('invalid selected values and too-few or zero-denominator cohorts produce no improvement claim', () => {
  const raw = readings(); raw[5].electricityKwh = -4;
  const result = assessQualityReview(raw, review());
  assert.deepEqual(result.invalidIds, ['a6']); assert.equal(result.reviewed.change, null); assert.equal(result.status, 'insufficient');
  const chosen = review(); chosen.exclusions = [{ phase: 'after', date: '2026-10-06', reason: 'Invalid entered consumption; raw retained' }];
  assert.notEqual(assessQualityReview(raw, chosen).reviewed.change, null);
  const few = readings().filter((item) => !['a7', 'a8'].includes(item.id));
  assert.equal(assessQualityReview(few, review()).reviewed.change, null);
  const zero = readings().map((item) => item.phase === 'after' ? { ...item, electricityKwh: 0 } : item);
  assert.equal(assessQualityReview(zero, review()).reviewed.change, null);
  const nonfinite = readings(); nonfinite[0].compressorHours = Infinity;
  assert.equal(assessQualityReview(nonfinite, review()).reviewed.change, null);
});

// Local timezone/DST must not move a measurement into a different implicit review day.
test('UTC calendar windows normalize explicit timestamp offsets and defaults retain exact day boundaries', () => {
  const defaults = defaultQualityReview({ id: 'qa-experiment', durationDays: 7, startedAt: '2026-10-08T00:30:00.000Z' });
  assert.equal(defaults.beforeStart, '2026-10-01'); assert.equal(defaults.beforeEnd, '2026-10-07');
  assert.equal(defaults.afterStart, '2026-10-08'); assert.equal(defaults.afterEnd, '2026-10-14');
  const raw = readings(); raw.find((item) => item.id === 'a5').measuredAt = '2026-10-06T00:30:00+02:00';
  const result = assessQualityReview(raw, review());
  assert.equal(result.days.find((day) => day.phase === 'after' && day.date === '2026-10-05').measurements[0].id, 'a5');
  assert.deepEqual(result.missingDates.after, []);
});

// Invalid visible input and unknown archive fields must not reuse prior valid review settings.
test('review validation rejects impossible overlap unequal windows and unreasoned or duplicate exclusions', () => {
  const cases = [
    { ...review(), beforeStart: '2026-02-30' },
    { ...review(), afterStart: '2026-10-04' },
    { ...review(), beforeStart: '2026-10-02' },
    { ...review(), beforeStart: '2026-01-01' },
    { ...review(), exclusions: [{ phase: 'after', date: '2026-10-08', reason: '  ' }] },
    { ...review(), exclusions: [{ phase: 'after', date: '2026-11-01', reason: 'outside window' }] },
    { ...review(), exclusions: Array(2).fill({ phase: 'after', date: '2026-10-08', reason: 'duplicate' }) },
    { ...review(), schemaVersion: 99 },
    { ...review(), experimentId: 'someone-else' },
    { ...review(), silentlyIgnored: true },
  ];
  for (const value of cases) assert.throws(() => validateQualityReview(value, 'qa-experiment'));
  assert.deepEqual(decodeQualityReview(encodeQualityReview(review()), 'qa-experiment'), review());
  for (const text of ['{broken', JSON.stringify(review()) + ' trailing', JSON.stringify({ ...review(), schemaVersion: 2 })]) {
    assert.throws(() => decodeQualityReview(text, 'qa-experiment'));
  }
});

// Identical cohorts must never gain apparent efficiency; finite input overflow must not print NaN/Infinity.
test('identical cohorts have zero gain and nonfinite derived comparisons are withheld', () => {
  const same = readings().map((item) => ({ ...item, electricityKwh: 20 }));
  const result = assessQualityReview(same, review());
  assert.equal(result.all.change, 0); assert.equal(result.reviewed.change, 0); assert.equal(result.sensitivityPoints, 0);
  const overflow = readings().map((item) => ({ ...item, electricityKwh: Number.MAX_VALUE, heatKwh: Number.MAX_VALUE }));
  assert.equal(assessQualityReview(overflow, review()).reviewed.change, null);
});
