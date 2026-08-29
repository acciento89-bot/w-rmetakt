import { Measurement } from './database';

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const rounded = (value: number, digits = 1) => Number(value.toFixed(digits));

export type InsightKey = 'collectData' | 'excellentCop' | 'lowCop' | 'shortCycles' | 'highFlow' | 'wideDelta' | 'comfortStable' | 'comfortRisk' | 'weatherImproved';

export function analyzeMeasurements(measurements: Measurement[]) {
  const before = measurements.filter((item) => item.phase === 'before');
  const after = measurements.filter((item) => item.phase === 'after');
  const normalized = (items: Measurement[]) => average(items.map((item) => item.electricityKwh / Math.max(1, 20 - item.outsideC)));
  const baseline = normalized(before), current = normalized(after);
  const change = baseline && current ? Math.round(((baseline - current) / baseline) * 100) : 0;
  const totalElectricity = after.reduce((sum, item) => sum + item.electricityKwh, 0);
  const totalHeat = after.reduce((sum, item) => sum + item.heatKwh, 0);
  const cop = totalElectricity ? totalHeat / totalElectricity : 0;
  const beforeStarts = average(before.map((item) => item.compressorStarts));
  const starts = average(after.map((item) => item.compressorStarts));
  const cyclesChange = beforeStarts ? Math.round(((starts - beforeStarts) / beforeStarts) * 100) : 0;
  const comfort = average(after.map((item) => item.roomC));
  const avgElectricity = average(after.map((item) => item.electricityKwh));
  const avgHeat = average(after.map((item) => item.heatKwh));
  const avgFlow = average(after.filter((item) => item.flowC > 0).map((item) => item.flowC));
  const avgReturn = average(after.filter((item) => item.returnC > 0).map((item) => item.returnC));
  const deltaT = avgFlow && avgReturn ? avgFlow - avgReturn : 0;
  const runtimePerStart = starts ? average(after.map((item) => item.compressorHours)) * 60 / starts : 0;
  const enoughData = before.length >= 3 && after.length >= 3;
  const dataQuality = Math.min(100, Math.round((Math.min(before.length, 7) + Math.min(after.length, 7)) / 14 * 100));
  const score = enoughData ? Math.max(0, Math.min(100, Math.round(62 + change + (cop - 3) * 9 - Math.max(0, starts - 12)))) : Math.min(60, 20 + measurements.length * 6);

  const insights: InsightKey[] = [];
  if (!enoughData) insights.push('collectData');
  if (cop >= 4) insights.push('excellentCop'); else if (cop > 0 && cop < 3) insights.push('lowCop');
  if (runtimePerStart > 0 && runtimePerStart < 25) insights.push('shortCycles');
  if (avgFlow > 45) insights.push('highFlow');
  if (deltaT > 8) insights.push('wideDelta');
  if (comfort >= 20 && comfort <= 22.5) insights.push('comfortStable'); else if (comfort > 0) insights.push('comfortRisk');
  if (enoughData && change > 3) insights.push('weatherImproved');

  return {
    change, cop: rounded(cop, 2), cyclesChange, comfort: rounded(comfort), score,
    avgElectricity: rounded(avgElectricity), avgHeat: rounded(avgHeat), starts: rounded(starts),
    avgFlow: rounded(avgFlow), avgReturn: rounded(avgReturn), deltaT: rounded(deltaT),
    runtimePerStart: rounded(runtimePerStart), dataQuality, enoughData, beforeCount: before.length,
    afterCount: after.length, insights,
  };
}
