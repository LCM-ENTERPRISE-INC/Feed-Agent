import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ timestamp, level, message, stack, instanceId }) => {
      const idStr = instanceId ? `[Instance:${instanceId}] ` : '';
      return `${timestamp} ${level}: [Warm-up] ${idStr}${message} ${stack || ''}`
    }
  )
);

// Cria um logger totalmente isolado para as rotinas de Warm-up.
// Essencial para auditoria de anti-spam (rastrear por que o chip foi banido ou pausado).
export const warmupLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { module: 'warmup' },
  transports: [
    new DailyRotateFile({
      filename: 'logs/warmup-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d',
    }),
    new DailyRotateFile({
      filename: 'logs/warmup-audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // Guardamos auditoria de warmup por mais tempo
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  warmupLogger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

/**
 * Função utilitária rápida para logar transições de fase com segurança.
 */
export const logWarmupTransition = (instanceId: number, previousPhase: string, newPhase: string) => {
  warmupLogger.info(`Transitioned from ${previousPhase} to ${newPhase}`, { instanceId, previousPhase, newPhase });
};
