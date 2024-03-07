const lodash = require('lodash');

const sfdc = require('../lib/sfdc');
const query = require('../lib/queries');

const logger = require('../lib/logger');
const utils = require('../lib/utils');
global.logger = utils.getLogger('dump_raleigh_contacts');

let query_bulk_bound, query_bound, write_bound;

/**
 * Binds the functions with the connection
 * @param {Object} conn The Salesforce connection
 * @returns {Promise} A promise for when the variables are bound
 */
function bind(conn) {
    return new Promise(function (resolve) {
        logger.info('Binding functions');

        query_bulk_bound = sfdc.bulk.query.bind(null, conn);
        query_bound = sfdc.query.bind(null, conn);
        write_bound = utils.writeFile.bind(null, utils.getOutputFile('raleighContacts'));
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

        query_bulk_bound(query.contact.durham())
            .then(function (results) {
                logger.info(`Got ${results.length} contacts back`);
                resolve(results);
            })
            .catch(reject);
    });
}

/**
 * Gets the notes for a set of contact ids
 * @param {String[]} contact_ids The contact ids to get notes for
 * @returns {Promise} A promise for notes on the contacts
 */
function dumpNotes_subset(contact_ids) {
    return new Promise(function (resolve, reject) {
        query_bulk_bound(query.contact.notes(contact_ids))
            .then(function (results) {
                logger.info(`Got ${results.length} notes back`);
                resolve(results);
            })
            .catch(reject);
    });
}

/**
 * Gets the attachments for a set of contact ids
 * @param {String[]} contact_ids The contact ids to get notes for
 * @returns {Promise} A promise for attachments on the contacts
 */
function dumpAttachments_subset(contact_ids) {
    return new Promise(function (resolve, reject) {
        query_bound(query.contact.attachments(contact_ids))
            .then(function (results) {
                logger.info(`Got ${results.length} attchments back`);
                resolve(results);
            })
            .catch(reject);
    });
}

/**
 * Splits the contact list and runs the provide function against the ids
 * @param {Object[]} contacts A list of contacts
 * @param {Function} func The function to call
 * @returns {Promise} A promise for all the contact data
 */
function splitAndDump(contacts, func) {
    return new Promise(function (resolve) {
        const promises = [];

        lodash.each(lodash.chunk(contacts, 200), function (contact_chunk) {
            const contact_ids = lodash.map(contact_chunk, 'Id');

            promises.push(func(contact_ids));
        });

        utils.combinePromiseOutput(promises, resolve);
    });
}

/**
 * Dumps the notes for a list of contacts
 * @param {Object[]} contacts A list of contacts
 * @returns {Promise} A promise for all the contact notes
 */
function dumpNotes(contacts) {
    return splitAndDump(contacts, dumpNotes_subset);
}

/**
 * Dumps the attachments for a list of contacts
 * @param {Object[]} contacts A list of contacts
 * @returns {Promise} A promise for all the contact attachments
 */
function dumpAttachments(contacts) {
    return splitAndDump(contacts, dumpAttachments_subset);
}

/**
 * Dumps the notes and attachments for all the contacts
 * @param {Object[]} contacts A list of contacts
 * @returns {Promise} A promise for all the data
 */
function dumpData(contacts) {
    return new Promise(function (resolve) {
        const promises = [];

        promises.push(dumpNotes(contacts));
        promises.push(dumpAttachments(contacts));

        Promise.allSettled(promises)
            .then(function (results) {
                const attachments = [];
                const notes = [];

                results.forEach(function (result) {
                    if (result.status !== 'fulfilled') {
                        logger.error(result.reason);
                    } else {
                        result.value.forEach(function (record) {
                            if (record.BodyLength) {
                                delete record.attributes;
                                attachments.push(record);
                            } else {
                                notes.push(record);
                            }
                        });
                    }
                });

                const data = {
                    contacts: contacts,
                    attachments: attachments,
                    notes: notes
                };
                resolve(data);
            });
    });
}

/**
 * Writes the notes and attachment data to disk
 * @param {Object} data The note and attachment data
 * @returns {Promise} A promise for when the data is written to disk
 */
function writeNotesAndAttachments(data) {
    return new Promise(function (resolve, reject) {
        utils.writeFile(utils.getOutputFile('raleighNotes'), data.notes)
            .then(function () {
                return new Promise(function (resolve_attach, reject_attach) {
                    utils.writeFile(utils.getOutputFile('raleighAttachments'), data.attachments)
                        .then(resolve_attach)
                        .catch(reject_attach);
                });
            })
            .then(resolve)
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
            .then(dumpData)
            .then(writeNotesAndAttachments)
            .then(resolve)
            .catch(reject);
    });
}

sfdc.login('raleigh')
    .then(bind)
    .then(work)
    .catch(utils.handleError)
    .finally(utils.exit);