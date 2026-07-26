"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWarmupTransition = exports.warmupLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, stack, instanceId }) => {
    const idStr = instanceId ? `[Instance:${instanceId}] ` : '';
    return `${timestamp} ${level}: [Warm-up] ${idStr}${message} ${stack || ''}`;
}));
// Cria um logger totalmente isolado para as rotinas de Warm-up.
// Essencial para auditoria de anti-spam (rastrear por que o chip foi banido ou pausado).
exports.warmupLogger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { module: 'warmup' },
    transports: [
        new winston_daily_rotate_file_1.default({
            filename: 'logs/warmup-error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxFiles: '14d',
        }),
        new winston_daily_rotate_file_1.default({
            filename: 'logs/warmup-audit-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d', // Guardamos auditoria de warmup por mais tempo
        }),
    ],
});
if (process.env.NODE_ENV !== 'production') {
    exports.warmupLogger.add(new winston_1.default.transports.Console({
        format: consoleFormat,
    }));
}
/**
 * Função utilitária rápida para logar transições de fase com segurança.
 */
const logWarmupTransition = (instanceId, previousPhase, newPhase) => {
    exports.warmupLogger.info(`Transitioned from ${previousPhase} to ${newPhase}`, { instanceId, previousPhase, newPhase });
};
exports.logWarmupTransition = logWarmupTransition;
