const bunyan = require('bunyan');
const fs = require('fs');
const jsonfile = require('jsonfile');
const lodash = require('lodash');
const moment = require('moment');
const path = require('path');

const config = require('../config.json');
const logger = require('./logger');

/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param {String} str the input value
 * @param {Boolean} [asString=false] set to true to return the hash value as
 *     8-digit hex string instead of an integer
 * @param {Integer} [seed] optionally pass the hash of the previous chunk
 * @returns {Integer | String} The hash
 */
function hashFnv32a(str, asString, seed) {
    /*jshint bitwise:false */
    var i, l;
    var hval = seed === undefined ? 0x811c9dc5 : seed;

    for (i = 0, l = str.length; i < l; i += 1) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if (asString) {
        // Convert to 8 digit hex string
        return ('0000000' + (hval >>> 0).toString(16)).substr(-8);
    }
    return hval >>> 0;
}

/**
 * Gets a unique hash for the user and query combination
 * @param {Object} conn The Salesforce connection
 * @param {String} query The Salesforce query
 * @returns {String} A combination of the userId and the hash for the query
 */
function userHash(conn, query) {
    const hash = hashFnv32a(query, true);
    return `${conn.userInfo.id}-${hash}`;
}

/**
 * Gets the log file
 * @param {String} name The script name
 * @returns {String} The log file
 */
function getLogFile(name) {
    return path.join(config.log_dir, name + '.log');
}

/**
 * Gets an instance of Bunyan
 * @param {String} name The script name
 * @return {Object} An instance of Bunyan
 */
function getLogger(name) {
    return bunyan.createLogger({
        name: name,
        streams: [
            {
                level: 'debug',
                stream: process.stdout
            },
            {
                level: 'trace',
                path: getLogFile(name)
            }
        ]
    });
}

/**
 * Gets the output file
 * @param {String} name The script name
 * @param {String} ext The file extension
 * @returns {String} The output file
 */
function getOutputFile(name, ext) {
    const today = moment();

    ext = ext === undefined ? 'json' : ext;

    return path.join(config.data.dir, `${today.format('YYYYMMDD')}_${name}.${ext}`);
}

/**
 * Writes data to a disk
 * @param {String} file_name The filename
 * @param {Object} data The data to write
 * @returns {Promise} A promise for when the file has been written
 */
function writeFile(file_name, data) {
    return new Promise(function (resolve, reject) {
        logger.info(`Writing data to ${file_name}`);

        jsonfile.writeFile(file_name, data, function (error) {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * Reads data from disk
 * @param {String} file_name The filename
 * @returns {Promise} A promise for when the file has been read
 */
function readFile(file_name) {
    return new Promise(function (resolve, reject) {
        logger.info(`Reading data from ${file_name}`);

        jsonfile.readFile(file_name, function (error, data) {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * Writes raw data to a file
 * @param {String} file_name The filename
 * @param {String} data The data
 * @returns {Promise} A promise for when the data has been written
 */
function writeRawFile(file_name, data) {
    return new Promise(function (resolve, reject) {
        logger.info(`Writing data to ${file_name}`);

        fs.writeFile(file_name, data, function (error) {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Handles an error and exits
 * @param {Error} err The error
 * @returns {undefined}
 */
function handleError(err) {
    global.logger.error(err);
    process.exit(-1);
}

/**
 * Exits
 * @returns {undefined}
 */
function exit() {
    process.exit(0);
}

/**
 * Quotes a string
 * @param {String} s The string to quote
 * @returns {String} The quoted string
 */
function quoteString(s) {
    return `'${s}'`;
}

/**
 * Quotes an array of strings
 * @param {String[]} strings An array of strings to quote
 * @returns {String[]} The quoted strings
 */
function quoteStrings(strings) {
    return lodash.map(strings, quoteString);
}

/**
 * Combines all the data and outputs any errors to the log
 * @param {Promise[]} promises The promises to wait for
 * @param {Function} resolve The resolve function
 * @return {undefined}
 */
function combinePromiseOutput(promises, resolve) {
    let data = [];

    Promise.allSettled(promises)
        .then(function (results) {
            results.forEach(function (result) {
                if (result.status !== 'fulfilled') {
                    logger.error(result.reason);
                } else {
                    data = lodash.union(data, result.value);
                }
            });

            resolve(data);
        });
}

module.exports = {
    combinePromiseOutput: combinePromiseOutput,
    exit: exit,
    getLogFile: getLogFile,
    getLogger: getLogger,
    getOutputFile: getOutputFile,
    handleError: handleError,
    hash: hashFnv32a,
    quoteString: quoteString,
    quoteStrings: quoteStrings,
    readFile: readFile,
    userHash: userHash,
    writeFile: writeFile,
    writeRawFile: writeRawFile
};