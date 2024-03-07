const fs = require('fs');
const jsonfile = require('jsonfile');
const moment = require('moment');
const path = require('path');

const config = require('../config');
const logger = require('./logger');

/**
 * Gets the age in days since the file was last modified
 * @param {String} file_path The file path to check
 * @returns {Promise} A promise for the age in days
 */
function getAge(file_path) {
    return new Promise(function (resolve, reject) {
        logger.debug(`Cache file ${file_path}`);
        fs.stat(file_path, function (err, stats) {
            if (err) {
                reject(err);
            } else {
                const age = moment().diff(moment(stats.mtime), 'days');

                logger.debug(`Cache age ${age}`);
                logger.debug(`Cache expire ${config.cache.expire}`);

                if (age <= config.cache.expire) {
                    resolve(file_path);
                } else {
                    logger.trace(`Cache for ${file_path} is ${age} days old and is expired`);
                    reject(new Error('File cache has expired'));
                }
            }
        });
    });
}

/**
 * Returns the cached data
 * @param {String} hash The path to the file
 * @returns {Promise} A promise for the cached data
 */
function read(hash) {
    return new Promise(function (resolve, reject) {
        const file = path.join(config.cache.dir, hash + '.json');

        getAge(file)
            .then(function () {
                jsonfile.readFile(file, function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            })
            .catch(reject);
    });
}

/**
 * Writes the cache to disk
 * @param {String} hash The hash
 * @param {Object[]} data The data
 * @returns {Promise} A promise for when the cache is written
 */
function write(hash, data) {
    return new Promise(function (resolve, reject) {
        const file = path.join(config.cache.dir, hash + '.json');

        jsonfile.writeFile(file, data, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

module.exports = {
    read: read,
    write: write
};