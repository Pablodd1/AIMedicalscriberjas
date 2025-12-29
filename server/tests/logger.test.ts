import { describe, it, expect, vi } from 'vitest';
import { log, logError } from '../logger';
import winston from 'winston';

vi.mock('winston', () => {
  const mFormat = {
    combine: vi.fn(),
    timestamp: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn(),
    json: vi.fn(),
  };

  const mTransports = {
    Console: vi.fn(),
  };

  const mLogger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  return {
    default: {
      format: mFormat,
      transports: mTransports,
      createLogger: vi.fn(() => mLogger),
    },
    format: mFormat,
    transports: mTransports,
    createLogger: vi.fn(() => mLogger),
  };
});

describe('Logger', () => {
  it('should call logger.info with the correct arguments', () => {
    const message = 'Test message';
    const context = { requestId: '123' };
    log(message, context);
    expect(winston.createLogger().info).toHaveBeenCalledWith(message, context);
  });

  it('should call logger.error with the correct arguments', () => {
    const message = 'Test error';
    const error = new Error('Test error');
    const context = { requestId: '123' };
    logError(message, error, context);
    expect(winston.createLogger().error).toHaveBeenCalledWith(message, {
      error: error.stack,
      ...context,
    });
  });
});
