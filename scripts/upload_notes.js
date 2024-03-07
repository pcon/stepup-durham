const path = require('path');
const groupBy = require('lodash/groupBy');
const has = require('lodash/has');

const config = require('../config.json');
const sfdc = require('../lib/sfdc');

const logger = require('../lib/logger');
const utils = require('../lib/utils');
global.logger = utils.getLogger('upload_notes');

let insert_bound;

/**
 * Binds the functions with the connection
 * @param {Object} conn The Salesforce connection
 * @returns {Promise} A promise for when the variables are bound
 */
function bind(conn) {
    return new Promise(function (resolve) {
        logger.info('Binding functions');

        conn.bulk.pollTimeout = 25000;
        insert_bound = sfdc.bulk.insert.bind(null, conn, 'Note');

        resolve();
    });
}

/**
 * Loads the joined contacts from disk
 * @returns {Promise} A promise for when the contacts have been loaded
 */
function loadJoinedContacts() {
    return new Promise(function (resolve, reject) {
        const data = {
            contacts: []
        };
        const file_name = path.join(config.data.dir, config.data.contacts.matched);

        logger.info(`Loading matched contacts from ${file_name}`);

        utils.readFile(file_name)
            .then(function (contacts) {
                data.contacts = contacts;
                resolve(data);
            })
            .catch(reject);
    });
}

/**
 * Load the notes from disk
 * @param {Object} data The data
 * @returns {Promise} A promise for the note data
 */
function loadNotes(data) {
    return new Promise(function (resolve, reject) {
        const file_name = path.join(config.data.dir, config.data.notes.src);

        logger.info(`Loading notes from ${file_name}`);

        utils.readFile(file_name)
            .then(function (notes) {
                data.notes = notes;
                resolve(data);
            })
            .catch(reject);
    });
}

/**
 * Maps the notes to their owners
 * @param {Object} data The data
 * @returns {Promise} A promise for when the data has been transformed
 */
function transformData(data) {
    return new Promise(function (resolve) {
        logger.info(`Transforming data for ${data.notes.length} notes`);
        data.noteMap = groupBy(data.notes, 'ParentId');

        resolve(data);
    });
}

/**
 * Creates the new notes to insert
 * @param {Object} data The data
 * @returns {Promise} A promise for when the data has been created
 */
function createNewNotes(data) {
    return new Promise(function (resolve) {
        data.newNotes = [];
        data.noNotes = [];

        data.contacts.forEach(function (contact) {
            if (!has(data.noteMap, contact.Id)) {
                logger.debug(`Unable to find notes for ${contact.Id}`);
                data.noNotes.push(contact);
            } else {
                data.noteMap[contact.Id].forEach(function (note) {
                    const newNote = {
                        Title: note.Title,
                        Body: note.Body,
                        IsPrivate: note.IsPrivate,
                        ParentId: contact.NewId,
                        OwnerId: config.data.notes.default_owner
                    };
                    data.newNotes.push(newNote);
                });
            }
        });

        logger.info(`Unable to find notes for ${data.noNotes.length} contacts`);

        resolve(data);
    });
}

/**
 * Uploads the note data to Salesforce
 * @param {Object} data The data
 * @returns {Promise} A promise for when the notes have been uploaded
 */
function uploadNotes(data) {
    return new Promise(function (resolve) {
        logger.info(`Uploading ${data.newNotes.length} notes`);

        insert_bound(data.newNotes, function (error, results) {
            const failed = [];
            const success = [];

            results.forEach(function (result) {
                if (result.success) {
                    success.push(result.id);
                } else {
                    failed.push(result.errors.join(', '));
                }
            });

            logger.info(`Inserted ${success.length} records successfully`);
            logger.info(`Failed to insert ${failed.length} records`);

            resolve(data);
        });
    });
}

/**
 * Does the work
 * @returns {Promise} A promise for when the work is done
 */
function work() {
    return new Promise(function (resolve, reject) {
        loadJoinedContacts()
            .then(loadNotes)
            .then(transformData)
            .then(createNewNotes)
            .then(uploadNotes)
            .then(resolve)
            .catch(reject);
    });
}

sfdc.login('trailhead')
    .then(bind)
    .then(work)
    .catch(utils.handleError)
    .finally(utils.exit);