/**
 * Sets up the logger if it's not been configured
 * @returns {void}
 */
function setupLogger() {
    if (global.logger === undefined) {
        global.logger = {
            fatal: console.error,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug,
            trace: console.trace
        };
    }
}

/**
 * Fatal logs the data
 * @param {Object} data The data to log
 * @returns {void}
 */
function fatal(data) {
    setupLogger();
    global.logger.fatal(data);
}

/**
 * Error logs the data
 * @param {Object} data The data to log
 * @returns {void}
 */
function error(data) {
    setupLogger();
    global.logger.error(data);
}

/**
 * Warn logs the data
 * @param {Object} data The data to log
 * @returns {void}
 */
function warn(data) {
    setupLogger();
    global.logger.warn(data);
}

/**
 * Info logs the data
 * @param {Object} data The data to log
 * @returns {void}
 */
function info(data) {
    setupLogger();
    global.logger.info(data);
}

/**
 * Debug logs the data
 * @param {Object} data The data to log
 * @returns {void}
 */
function debug(data) {
    setupLogger();
    global.logger.debug(data);
}

/**
 * Trace logs the data
 * @param {Object} data The data to log
 * @returns {void}
 */
function trace(data) {
    setupLogger();
    global.logger.trace(data);
}

module.exports = {
    fatal: fatal,
    error: error,
    warn: warn,
    info: info,
    debug: debug,
    trace: trace
};