const jsforce = require('jsforce');
const lodash = require('lodash');
const fs = require('fs');

const cache = require('./cache');
const logger = require('./logger');
const utils = require('./utils');

const config = require('../config.json');

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
 * Generates the query string
 * @param {String[]} fields The fields to query
 * @param {String} object_name The object name
 * @param {String} where_clause The where clause
 * @param {String} order_clause The order clause
 * @param {String} limit_count The limit count
 * @returns {String} The query
 */
function generateQuery(fields, object_name, where_clause, order_clause, limit_count) {
    let parts = [
        'select',
        fields,
        `from ${object_name}`
    ];

    if (lodash.isArray(where_clause)) {
        parts.push(`where ${lodash.join(where_clause, ' AND ')}`);
    } else if (where_clause) {
        parts.push(`where ${where_clause}`);
    }

    if (order_clause) {
        parts.push(`order by ${order_clause}`);
    }

    if (limit_count) {
        parts.push(`limit ${limit_count}`);
    }

    return lodash.join(parts, ' ');
}

/**
 * Logs into Salesforce
 * @param {String} env The environment name
 * @returns {Promise} A promise for the connection
 */
function login(env) {
    return new Promise(function (resolve, reject) {
        logger.info(`Logging into ${env}`);

        const conn = new jsforce.Connection({
            maxRequest: 200
        });

        conn.login(
            config.salesforce[env].username,
            config.salesforce[env].password,
            function (error) {
                if (error) {
                    reject(error);
                } else {
                    resolve(conn);
                }
            });
    });
}

/**
 * Queries Salesforce
 * @param {Object} conn The Salesforce connection
 * @param {String} query The query
 * @returns {Promise} A promise for the query results
 */
function query(conn, query) {
    return new Promise(function (resolve, reject) {
        const hash = utils.userHash(conn, query);
        cache.read(hash)
            .then(resolve)
            .catch(function () {
                conn.query(query, function (error, res) {
                    if (error) {
                        reject(error);
                    } else {
                        cache.write(hash, res.records)
                            .then(resolve)
                            .catch(reject);
                    }
                });
            });
    });
}

/**
 * Inserts a set of records
 * @param {Object} conn The Salesforce connection
 * @param {String} object_name The object name
 * @param {Object[]} records The records to insert
 * @returns {Promise} A promise for when the insert is complete
 */
function insert(conn, object_name, records) {
    return new Promise(function (resolve, reject) {
        conn.sobject(object_name).create(records, function (error, res) {
            if (error) {
                reject(error);
            } else {
                resolve(res);
            }
        });
    });
}

/**
 * Makes a bulk query
 * @param {Object} conn The jsforce connection
 * @param {String} query The query
 * @returns {Promise} A promise for the data from the query
 */
function bulk_query(conn, query) {
    return new Promise(function (resolve, reject) {
        var results = [];

        const hash = utils.userHash(conn, query);
        cache.read(hash)
            .then(resolve)
            .catch(function () {
                conn.bulk.pollInterval = 5000;
                conn.bulk.pollTimeout = 600000;
                conn.bulk.query(query)
                    .on('record', function (data) {
                        results.push(data);
                    }).on('error', function (error) {
                        reject(error);
                    }).on('finish', function () {
                        cache.write(hash, results)
                            .then(resolve)
                            .catch(reject);
                    });
            });
    });
}

/**
 * Does a bulk insert of an object
 * @param {Object} conn The Salesforce connection
 * @param {String} object_name The Object's name
 * @param {Object[]} data The data to insert
 * @param {Function} fn The callback function
 * @return {undefined}
 */
function bulk_insert(conn, object_name, data, fn) {
    conn.bulk.load(object_name, 'insert', data, fn);
}

/**
 * Uploads an attachment
 * @param {Object} conn The Salesforce connection
 * @param {Object} attachment The attachment metadata to upload
 * @param {String} file_path The path to the file
 * @returns {Promise} A promise for when the attachment is uploaded
 */
function attachment_upload(conn, attachment, file_path) {
    return new Promise(function (resolve, reject) {
        logger.trace(`Uploading ${file_path}`);

        fs.readFile(file_path, function (error, data) {
            if (error) {
                reject(error);
                return;
            }

            var base64data = Buffer.from(data).toString('base64');
            attachment.Body = base64data;
            conn.sobject('Attachment')
                .create(attachment, function (create_error, result) {
                    if (create_error) {
                        reject(create_error);
                    } else {
                        resolve(result);
                    }
                });
        });
    });
}

module.exports = {
    login: login,
    query: query,
    insert: insert,
    attachment: {
        upload: attachment_upload
    },
    bulk: {
        query: bulk_query,
        insert: bulk_insert
    },
    utils: {
        generateQuery: generateQuery,
        quoteStrings: quoteStrings
    },
    query_builder: {}
};