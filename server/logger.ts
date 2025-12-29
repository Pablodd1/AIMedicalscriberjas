import winston from 'winston';

const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'demo';

const { combine, timestamp, printf, colorize, json } = winston.format;

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    process.env.NODE_ENV === 'production' ? json() : combine(colorize(), customFormat)
  ),
  transports: [
    new winston.transports.Console({
      silent: DEMO_MODE,
    }),
  ],
});

interface LogContext {
  requestId?: string;
  [key: string]: any;
}

export const log = (message: string, context?: LogContext) => {
  logger.info(message, context);
};

export const logError = (message: string, error?: any, context?: LogContext) => {
  logger.error(message, { error: error?.stack || error, ...context });
};

export default logger;
