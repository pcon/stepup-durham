const path = require('path');
const groupBy = require('lodash/groupBy');
const has = require('lodash/has');

const config = require('../config.json');
const sfdc = require('../lib/sfdc');

const logger = require('../lib/logger');
const utils = require('../lib/utils');
global.logger = utils.getLogger('upload_attachments');

let upload_bound;
let failures = [];
let successes = [];

/**
 * Binds the functions with the connection
 * @param {Object} conn The Salesforce connection
 * @returns {Promise} A promise for when the variables are bound
 */
function bind(conn) {
    return new Promise(function (resolve) {
        logger.info('Binding functions');

        upload_bound = sfdc.attachment.upload.bind(null, conn);

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
                logger.info(`Loaded ${contacts.length} contacts`);

                data.contacts = contacts;
                resolve(data);
            })
            .catch(reject);
    });
}

/**
 * Load the attachements from disk
 * @param {Object} data The data
 * @returns {Promise} A promise for the note data
 */
function loadAttachments(data) {
    return new Promise(function (resolve, reject) {
        const file_name = path.join(config.data.dir, config.data.attachments.src);

        logger.info(`Loading attachments from ${file_name}`);

        utils.readFile(file_name)
            .then(function (attachments) {
                logger.info(`Loaded ${attachments.length} attachments`);

                data.attachments = attachments;
                resolve(data);
            })
            .catch(reject);
    });
}

/**
 * Maps the attachments to their owners
 * @param {Object} data The data
 * @returns {Promise} A promise for when the data has been transformed
 */
function transformData(data) {
    return new Promise(function (resolve) {
        logger.info(`Transforming data for ${data.attachments.length} attachments`);
        data.attachmentMap = groupBy(data.attachments, 'ParentId');

        resolve(data);
    });
}

/**
 * Upload a subset of attachments
 * @param {Integer} index The current attachment index
 * @param {Object[]} attachments The attachments to upload
 * @param {Function} resolve The resolve function
 * @returns {Promise} A promise for when the attachments are uploaded
 */
function uploadAttachments(index, attachments, resolve) {
    const promises = [];
    let end_index = index + config.data.batch_size;

    if (end_index > attachments.length) {
        end_index = attachments.length;
    }

    logger.info(`Uploading attachments ${index + 1} - ${end_index + 1}`);

    for (let i = index; i < end_index; i += 1) {
        const attachment = attachments[i];
        const file_path = path.join(config.data.dir, config.data.attachments.dir, attachment.Id, attachment.Name);
        let attachment_metadata = Object.assign({}, attachment);
        delete attachment_metadata.Id;

        promises.push(upload_bound(attachment_metadata, file_path));
    }

    Promise.allSettled(promises)
        .then(function (results) {
            results.forEach(function (result) {
                if (result.status === 'rejected') {
                    failures.push(result.reason);
                } else {
                    successes.push(result.value);
                }
            });

            if (end_index === attachments.length) {
                resolve();
            } else {
                uploadAttachments(end_index, attachments, resolve);
            }
        });
}

/**
 * Uploads all the attachments
 * @param {Object} data The data
 * @returns {Promise} A promise for when all the attachments have been uploaded
 */
function uploadAllAttachments(data) {
    return new Promise(function (resolve) {
        const attachments = [];

        data.contacts.forEach(function (contact) {
            if (has(data.attachmentMap, contact.Id)) {
                data.attachmentMap[contact.Id].forEach(function (attachment) {
                    attachments.push({
                        Id: attachment.Id,
                        ParentId: contact.NewId,
                        OwnerId: config.data.attachments.default_owner,
                        Name: attachment.Name,
                        ContentType: attachment.ContentType,
                        Description: attachment.Description
                    });
                });
            }
        });

        logger.info(`Uploading ${attachments.length} attachments`);

        uploadAttachments(0, attachments, resolve);
    });
}

/**
 * Prints a report of the upload status
 * @returns {Promise} A promise for when the report has printed
 */
function report() {
    return new Promise(function (resolve) {
        logger.info(`Uploaded ${successes.length} attachments`);
        logger.info(`Upload failed for ${failures.length} attachments`);
        resolve();
    });
}

/**
 * Does the work
 * @returns {Promise} A promise for when the work is done
 */
function work() {
    return new Promise(function (resolve, reject) {
        loadJoinedContacts()
            .then(loadAttachments)
            .then(transformData)
            .then(uploadAllAttachments)
            .then(report)
            .then(resolve)
            .catch(reject);
    });
}

sfdc.login('trailhead')
    .then(bind)
    .then(work)
    .catch(utils.handleError)
    .finally(utils.exit);