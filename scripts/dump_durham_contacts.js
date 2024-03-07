const sfdc = require('../lib/sfdc');
const query = require('../lib/queries');

const logger = require('../lib/logger');
const utils = require('../lib/utils');
global.logger = utils.getLogger('dump_durham_contacts');

let query_bound, write_bound;

/**
 * Binds the functions with the connection
 * @param {Object} conn The Salesforce connection
 * @returns {Promise} A promise for when the variables are bound
 */
function bind(conn) {
    return new Promise(function (resolve) {
        logger.info('Binding functions');

        query_bound = sfdc.bulk.query.bind(null, conn);
        write_bound = utils.writeFile.bind(null, utils.getOutputFile('durhamContacts'));
        resolve();
    });
}

/**
 * Gets the contacts
 * @returns {Promise} A promise for the contacts
 */
function dumpContacts() {
    return new Promise(function (resolve, reject) {
        logger.info('Querying contacts');

        query_bound(query.contact.all())
            .then(function (results) {
                logger.info(`Got ${results.length} contacts back`);
                resolve(results);
            })
            .catch(reject);
    });
}

/**
 * Does the work
 * @returns {Promise} A promise for when the work is done
 */
function work() {
    return new Promise(function (resolve, reject) {
        dumpContacts()
            .then(write_bound)
            .then(resolve)
            .catch(reject);
    });
}

sfdc.login('durham')
    .then(bind)
    .then(work)
    .catch(utils.handleError)
    .finally(utils.exit);