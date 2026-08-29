import { Measurement } from './database';
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
export function analyzeMeasurements(measurements: Measurement[]) {
  const before = measurements.filter((item) => item.phase === 'before'), after = measurements.filter((item) => item.phase === 'after');
  const normalized = (items: Measurement[]) => average(items.map((item) => item.electricityKwh / Math.max(1, 20 - item.outsideC)));
  const baseline = normalized(before), current = normalized(after), change = baseline && current ? Math.round(((baseline - current) / baseline) * 100) : 0;
  const totalElectricity = after.reduce((sum, item) => sum + item.electricityKwh, 0), totalHeat = after.reduce((sum, item) => sum + item.heatKwh, 0);
  const cop = totalElectricity ? totalHeat / totalElectricity : 0, beforeStarts = average(before.map((item) => item.compressorStarts)), afterStarts = average(after.map((item) => item.compressorStarts));
  const cyclesChange = beforeStarts ? Math.round(((afterStarts - beforeStarts) / beforeStarts) * 100) : 0, comfort = average(after.map((item) => item.roomC));
  const score = Math.max(0, Math.min(100, Math.round(65 + change + (cop - 3) * 8)));
  return { change, cop, cyclesChange, comfort, score };
}
export const demoMeasurements: Measurement[] = [
  { id: 'b1', measuredAt: '2026-01-02', phase: 'before', electricityKwh: 6.2, heatKwh: 20.1, outsideC: 2.1, roomC: 21.1, compressorStarts: 11 },
  { id: 'b2', measuredAt: '2026-01-03', phase: 'before', electricityKwh: 5.8, heatKwh: 18.9, outsideC: 3.4, roomC: 21.0, compressorStarts: 10 },
  { id: 'b3', measuredAt: '2026-01-04', phase: 'before', electricityKwh: 5.1, heatKwh: 17.0, outsideC: 5.2, roomC: 21.0, compressorStarts: 10 },
  { id: 'a1', measuredAt: '2026-01-05', phase: 'after', electricityKwh: 5.0, heatKwh: 18.0, outsideC: 3.2, roomC: 21.0, compressorStarts: 8 },
  { id: 'a2', measuredAt: '2026-01-06', phase: 'after', electricityKwh: 4.7, heatKwh: 17.4, outsideC: 4.1, roomC: 20.9, compressorStarts: 8 },
  { id: 'a3', measuredAt: '2026-01-07', phase: 'after', electricityKwh: 4.4, heatKwh: 16.8, outsideC: 5.0, roomC: 21.0, compressorStarts: 7 },
];
