const winston = require("winston");

const LOG_LEVEL = process.env.LOG_LEVEL;
const SERVICE_NAME = process.env.SERVICE_NAME;

const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.json(),
    defaultMeta: {
        service: SERVICE_NAME,
    },
    /*
     * - Write all logs to the console.
     * - Write all logs with level `error` and below to `error.log`
     * - Write all logs with level `info` and below to `combined.log`
     */
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "error.log", level: "error" }),
        new winston.transports.File({ filename: "combined.log" }),
    ],
});

/*
 * If we are not in production then log to the `console` with the format:
 * `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
 */
/*if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}*/

module.exports = logger;
