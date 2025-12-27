import winston from 'winston';

const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'demo';

const logger = winston.createLogger({
  level: 'info',
  format: process.env.NODE_ENV === 'production' ? winston.format.json() : winston.format.simple(),
  transports: [
    new winston.transports.Console({
      silent: DEMO_MODE,
    }),
  ],
});

export const log = (message: string, context?: any) => {
  logger.info(message, context);
};

export const logError = (message: string, error?: any, context?: any) => {
  logger.error(message, { error, context });
};

export default logger;
