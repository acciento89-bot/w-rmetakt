import type { Experiment, Measurement } from './database';
import { analyzeMeasurements } from './domain.ts';

export type Phase = 'before' | 'after';
export type QualityExclusion = { phase: Phase; date: string; reason: string };
export type QualityReview = {
  schemaVersion: 1; experimentId: string;
  beforeStart: string; beforeEnd: string; afterStart: string; afterEnd: string;
  exclusions: QualityExclusion[];
};
const DAY = 86400000;
const phases: Phase[] = ['before', 'after'];
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).length !== expected.length || expected.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) throw new Error('Invalid review fields');
}
export function validateExperimentId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || value !== value.trim()) throw new Error('Invalid experiment identity');
}
function dayTime(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use YYYY-MM-DD');
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date');
  return time;
}
function dates(start: string, end: string): string[] {
  const first = dayTime(start), last = dayTime(end), length = (last - first) / DAY + 1;
  if (length < 3 || length > 31) throw new Error('Choose 3–31 calendar days per window');
  return Array.from({ length }, (_, index) => new Date(first + index * DAY).toISOString().slice(0, 10));
}
export function validateQualityReview(value: unknown, expectedId?: string): QualityReview {
  if (!record(value)) throw new Error('Invalid review');
  exactKeys(value, ['schemaVersion', 'experimentId', 'beforeStart', 'beforeEnd', 'afterStart', 'afterEnd', 'exclusions']);
  if (value.schemaVersion !== 1) throw new Error('Unsupported review version');
  validateExperimentId(value.experimentId);
  if (expectedId !== undefined && value.experimentId !== expectedId) throw new Error('Review belongs to another experiment');
  const before = dates(value.beforeStart as string, value.beforeEnd as string);
  const after = dates(value.afterStart as string, value.afterEnd as string);
  if (before.length !== after.length || dayTime(value.beforeEnd) >= dayTime(value.afterStart)) throw new Error('Choose equal non-overlapping windows, before first');
  if (!Array.isArray(value.exclusions) || value.exclusions.length > 62) throw new Error('Invalid exclusions');
  const seen = new Set<string>();
  const exclusions = value.exclusions.map((item: unknown): QualityExclusion => {
    if (!record(item)) throw new Error('Invalid exclusion');
    exactKeys(item, ['phase', 'date', 'reason']);
    if (item.phase !== 'before' && item.phase !== 'after') throw new Error('Invalid exclusion phase');
    if (typeof item.date !== 'string' || !(item.phase === 'before' ? before : after).includes(item.date)) throw new Error('Excluded day is outside its window');
    if (typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 500) throw new Error('An exclusion needs a reason (1–500 characters)');
    const key = `${item.phase}:${item.date}`;
    if (seen.has(key)) throw new Error('Duplicate exclusion');
    seen.add(key);
    return { phase: item.phase, date: item.date, reason: item.reason.trim() };
  });
  return { schemaVersion: 1, experimentId: value.experimentId, beforeStart: value.beforeStart as string, beforeEnd: value.beforeEnd as string, afterStart: value.afterStart as string, afterEnd: value.afterEnd as string, exclusions };
}
export function encodeQualityReview(value: unknown): string { return JSON.stringify(validateQualityReview(value)); }
export function decodeQualityReview(text: string, expectedId: string): QualityReview { return validateQualityReview(JSON.parse(text), expectedId); }
export function defaultQualityReview(experiment: Pick<Experiment, 'id' | 'startedAt' | 'durationDays'>): QualityReview {
  validateExperimentId(experiment.id);
  if (!Number.isInteger(experiment.durationDays) || experiment.durationDays < 3 || experiment.durationDays > 31) throw new Error('Unsupported experiment duration');
  const date = utcDay(experiment.startedAt);
  if (!date) throw new Error('Invalid experiment timestamp');
  const start = dayTime(date), at = (offset: number) => new Date(start + offset * DAY).toISOString().slice(0, 10);
  return validateQualityReview({ schemaVersion: 1, experimentId: experiment.id, beforeStart: at(-experiment.durationDays), beforeEnd: at(-1), afterStart: at(0), afterEnd: at(experiment.durationDays - 1), exclusions: [] });
}
function utcDay(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  try { dayTime(value.slice(0, 10)); } catch { return null; }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}
const numericKeys = ['electricityKwh', 'heatKwh', 'outsideC', 'roomC', 'compressorStarts', 'flowC', 'returnC', 'compressorHours', 'hotWaterKwh'] as const;
function validMeasurement(item: Measurement): boolean {
  return numericKeys.every((key) => typeof item[key] === 'number' && Number.isFinite(item[key])) &&
    ['electricityKwh', 'heatKwh', 'compressorStarts', 'compressorHours', 'hotWaterKwh'].every((key) => (item[key as keyof Measurement] as number) >= 0) && Number.isSafeInteger(item.compressorStarts);
}
export type QualityDay = { phase: Phase; date: string; measurements: readonly Measurement[]; excluded: boolean; reason: string | null };
export type QualityCohort = {
  change: number | null; beforeNormalizedMean: number | null; afterNormalizedMean: number | null;
  beforeCount: number; afterCount: number; beforeDays: number; afterDays: number;
  analysis: ReturnType<typeof analyzeMeasurements> | null;
};
function cohort(days: QualityDay[]): QualityCohort {
  const before = days.filter((day) => day.phase === 'before'), after = days.filter((day) => day.phase === 'after');
  const beforeRows = before.flatMap((day) => [...day.measurements]), afterRows = after.flatMap((day) => [...day.measurements]);
  const count = (items: QualityDay[]) => items.filter((day) => day.measurements.length > 0).length;
  const result: QualityCohort = { change: null, beforeNormalizedMean: null, afterNormalizedMean: null, beforeCount: beforeRows.length, afterCount: afterRows.length, beforeDays: count(before), afterDays: count(after), analysis: null };
  if (result.beforeDays < 3 || result.afterDays < 3 || days.some((day) => day.measurements.length > 1) || [...beforeRows, ...afterRows].some((item) => !validMeasurement(item))) return result;
  const normalized = (rows: Measurement[]) => rows.reduce((sum, item) => sum + item.electricityKwh / Math.max(1, 20 - item.outsideC), 0) / rows.length;
  const baseline = normalized(beforeRows), current = normalized(afterRows);
  if (!(baseline > 0 && current > 0) || !Number.isFinite(baseline) || !Number.isFinite(current)) return result;
  const analysis = analyzeMeasurements([...beforeRows, ...afterRows]);
  if (Object.values(analysis).some((value) => typeof value === 'number' && !Number.isFinite(value))) return result;
  return { ...result, beforeNormalizedMean: baseline, afterNormalizedMean: current, change: analysis.change, analysis };
}
export function assessQualityReview(measurements: readonly Measurement[], input: QualityReview) {
  const review = validateQualityReview(input);
  const days: QualityDay[] = phases.flatMap((phase) => dates(review[`${phase}Start`], review[`${phase}End`]).map((date) => {
    const exclusion = review.exclusions.find((item) => item.phase === phase && item.date === date);
    return { phase, date, measurements: measurements.filter((item) => item.phase === phase && utcDay(item.measuredAt) === date), excluded: !!exclusion, reason: exclusion?.reason ?? null };
  }));
  const selected = days.flatMap((day) => [...day.measurements]);
  const invalidIds = selected.filter((item) => !validMeasurement(item)).map((item) => item.id);
  const missingDates = { before: days.filter((day) => day.phase === 'before' && !day.measurements.length).map((day) => day.date), after: days.filter((day) => day.phase === 'after' && !day.measurements.length).map((day) => day.date) };
  const duplicateDates = { before: days.filter((day) => day.phase === 'before' && day.measurements.length > 1).map((day) => day.date), after: days.filter((day) => day.phase === 'after' && day.measurements.length > 1).map((day) => day.date) };
  const unusualIds: string[] = [];
  for (const phase of phases) {
    const rows = days.filter((day) => day.phase === phase && day.measurements.length === 1 && validMeasurement(day.measurements[0])).map((day) => day.measurements[0]);
    if (rows.length < 3) continue;
    const normalized = (item: Measurement) => item.electricityKwh / Math.max(1, 20 - item.outsideC);
    const sorted = rows.map(normalized).sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
    if (median > 0 && Number.isFinite(median)) unusualIds.push(...rows.filter((item) => normalized(item) / median < 0.5 || normalized(item) / median > 2).map((item) => item.id));
  }
  const all = cohort(days), included = days.filter((day) => !day.excluded), reviewed = cohort(included);
  const mean = (phase: Phase, key: 'outsideC' | 'roomC') => {
    const rows = included.filter((day) => day.phase === phase).flatMap((day) => [...day.measurements]);
    if (!rows.length || rows.some((row) => !validMeasurement(row))) return null;
    const value = rows.reduce((sum, row) => sum + row[key] / rows.length, 0);
    return Number.isFinite(value) ? value : null;
  };
  const difference = (key: 'outsideC' | 'roomC') => { const before = mean('before', key), after = mean('after', key); const result = before === null || after === null ? null : after - before; return result !== null && Number.isFinite(result) ? result : null; };
  const comparability = { outsideDifferenceC: difference('outsideC'), roomDifferenceC: difference('roomC') };
  const needsReview = !!(review.exclusions.length || unusualIds.length || missingDates.before.length || missingDates.after.length || Math.abs(comparability.outsideDifferenceC ?? 0) > 3 || Math.abs(comparability.roomDifferenceC ?? 0) > 1);
  const status: 'ready' | 'review' | 'insufficient' = reviewed.change === null ? 'insufficient' : needsReview ? 'review' : 'ready';
  return { all, reviewed, sensitivityPoints: all.change === null || reviewed.change === null ? null : reviewed.change - all.change, unusualIds, invalidIds, duplicateDates, missingDates, outsideSelectionCount: measurements.length - selected.length, days, comparability, status };
}
