import { execFileSync } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';

// Loads the config module in a fresh process with a controlled environment.
function loadConfig(env: Record<string, string>) {
  const script = `const { config } = require(${JSON.stringify(path.resolve(__dirname, '../../src/shared/config'))}); console.log(JSON.stringify({ apiDocs: config.apiDocs, logLevel: config.logLevel, cors: config.cors.origins }))`;
  const out = execFileSync(process.execPath, ['--import', 'tsx', '-e', script], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' });
  return JSON.parse(out.trim().split('\n').pop()!);
}

describe('environment config', () => {
  it('treats blank variables as unset (defaults apply instead of failing to boot)', () => {
    const cfg = loadConfig({ NODE_ENV: 'development', API_DOCS: '', LOG_LEVEL: '', CORS_ORIGINS: '' });
    expect(cfg).toEqual({ apiDocs: true, logLevel: 'info', cors: [] });
  });

  it('refuses to boot in production without a strong JWT secret', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});
