import { describe, expect, it } from 'vitest';
import { isCheckViolation, isForeignKeyViolation, isUniqueViolation, pgConstraint } from '../../src/shared/utils/pg-errors';

describe('pg error classification', () => {
  const pgError = { code: '23505', constraint: 'menu_items_name_lower_unique', message: 'duplicate key' };

  it('reads the SQLSTATE of a raw node-postgres error', () => {
    expect(isUniqueViolation(pgError)).toBe(true);
    expect(pgConstraint(pgError)).toBe('menu_items_name_lower_unique');
  });

  it('unwraps Drizzle query errors (driver error in `cause`)', () => {
    const wrapped = Object.assign(new Error('Failed query: insert into ...'), { cause: pgError });
    expect(isUniqueViolation(wrapped)).toBe(true);
    expect(isUniqueViolation(wrapped, 'menu_items_name_lower_unique')).toBe(true);
    expect(pgConstraint(wrapped)).toBe('menu_items_name_lower_unique');
    expect(isForeignKeyViolation(Object.assign(new Error('x'), { cause: { code: '23503' } }))).toBe(true);
    expect(isCheckViolation(Object.assign(new Error('x'), { cause: { code: '23514' } }))).toBe(true);
  });

  it('does not misclassify unrelated errors', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
