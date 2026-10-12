import { describe, expect, it } from 'vitest';
import { salesSummaryQuerySchema, topItemsQuerySchema } from '../../src/modules/reports/validation';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('reports validation', () => {
  it('requires YYYY-MM-DD and dateFrom <= dateTo', () => {
    expect(ok(salesSummaryQuerySchema, { dateFrom: '2026-01-01', dateTo: '2026-01-31' })).toBe(true);
    expect(ok(salesSummaryQuerySchema, { dateFrom: '2026-02-01', dateTo: '2026-01-01' })).toBe(false);
    expect(ok(salesSummaryQuerySchema, { dateFrom: '01/02/2026' })).toBe(false);
  });

  it('rejects dates that do not exist', () => {
    expect(ok(salesSummaryQuerySchema, { dateFrom: '2026-02-31' })).toBe(false);
    expect(ok(salesSummaryQuerySchema, { dateFrom: '2026-02-29' })).toBe(false);
    expect(ok(salesSummaryQuerySchema, { dateFrom: '2024-02-29' })).toBe(true);
  });

  it('defaults top-items limit to 5 and caps it at 20', () => {
    expect(topItemsQuerySchema.parse({}).limit).toBe(5);
    expect(ok(topItemsQuerySchema, { limit: '21' })).toBe(false);
  });
});
