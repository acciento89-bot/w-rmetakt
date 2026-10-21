import { decodeQualityReview, encodeQualityReview, validateExperimentId, validateQualityReview } from './experimentQuality.ts';
import type { QualityReview } from './experimentQuality.ts';

export interface ReviewQueries {
  getFirstAsync<T>(sql: string, ...params: string[]): Promise<T | null>;
  runAsync(sql: string, ...params: string[]): Promise<unknown>;
}
export interface ReviewClient extends ReviewQueries {
  withExclusiveTransactionAsync(task: (transaction: ReviewQueries) => Promise<void>): Promise<void>;
}
export function reviewStateKey(experimentId: string): string {
  validateExperimentId(experimentId);
  return `quality_review_v1:${experimentId}`;
}
export async function loadQualityReview(client: ReviewQueries, experimentId: string): Promise<QualityReview | null> {
  const row = await client.getFirstAsync<{ value: string }>('SELECT value FROM app_state WHERE key = ?', reviewStateKey(experimentId));
  return row === null ? null : decodeQualityReview(row.value, experimentId);
}
export async function saveQualityReview(client: ReviewClient, input: QualityReview): Promise<void> {
  // Snapshot before awaiting; callers may continue editing their local draft during I/O.
  const review = validateQualityReview(input), serialized = encodeQualityReview(review), key = reviewStateKey(review.experimentId);
  await client.withExclusiveTransactionAsync(async (transaction) => {
    // Re-read inside the same write transaction: a previously valid load is insufficient.
    const previous = await transaction.getFirstAsync<{ value: string }>('SELECT value FROM app_state WHERE key = ?', key);
    if (previous !== null) decodeQualityReview(previous.value, review.experimentId);
    await transaction.runAsync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', key, serialized);
  });
}
