import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.refreshToken', '*.accessToken'],
    censor: '[redacted]',
  },
  ...(config.isProd || config.isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } } }),
});
