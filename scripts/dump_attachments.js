const axios = require('axios');
const fs = require('fs');
const lodash = require('lodash');
const path = require('path');

const sfdc = require('../lib/sfdc');
const utils = require('../lib/utils');
const logger = require('../lib/logger');
global.logger = utils.getLogger('dump_raleigh_contacts');

const config = require('../config.json');

const attachment_path = path.join(config.data.dir, config.data.attachments.src);

let download_bound;

/**
 * Downloads an attachment
 * @param {Object} conn The Salesforce connection
 * @param {Object} attachment The attachment data
 * @returns {Promise} A promise for when the attachment has been downloaded
 */
function downloadAttachment(conn, attachment) {
    return new Promise(function (resolve, reject) {
        const attachment_dir = path.join(config.data.dir, config.data.attachments.dir, attachment.Id);
        const attachment_file = path.join(attachment_dir, attachment.Name.replaceAll('/', '_'));

        if (!fs.existsSync(attachment_dir)) {
            fs.mkdirSync(attachment_dir);
        }

        if (fs.existsSync(attachment_file)) {
            const stats = fs.statSync(attachment_file);

            if (attachment.BodyLength === stats.size) {
                resolve();
                return;
            }
        }

        const writer = fs.createWriteStream(attachment_file);
        const axios_config = {
            url: attachment.Body,
            method: 'get',
            baseURL: conn.instanceUrl,
            headers: {
                Authorization: `Bearer ${conn.accessToken}`
            },
            responseType: 'stream'
        };

        axios(axios_config)
            .then(function (response) {
                response.data.pipe(writer);

                let hadError = false;

                writer.on('error', function (error) {
                    hadError = true;
                    writer.close();
                    reject(error);
                });

                writer.on('close', function () {
                    if (!hadError) {
                        resolve();
                    }
                });
            });
    });
}

/**
 * Downloads a batch of attachments
 * @param {Object[]} attachments The attachments to download
 * @param {Integer} index The index of the batch
 * @param {Function} resolve The resolve function
 * @param {Function} reject The reject function
 * @returns {undefined}
 */
function downloadAttachments(attachments, index, resolve, reject) {
    let totalBatches = Math.floor(attachments.length / config.data.batch_size);
    const remainder = attachments.length % config.data.batch_size;

    if (remainder !== 0) {
        totalBatches += 1;
    }

    if (index === totalBatches) {
        resolve(attachments);
        return;
    }

    logger.info(`Downloading batch ${index + 1} of ${totalBatches}`);

    const promises = [];
    const startPos = index * config.data.batch_size;
    const endPos = startPos + config.data.batch_size;
    const toDownload = lodash.slice(attachments, startPos, endPos);

    toDownload.forEach(function (attachment) {
        promises.push(download_bound(attachment));
    });

    Promise.allSettled(promises)
        .then(function (results) {
            results.forEach(function (result) {
                if (result.status !== 'fulfilled') {
                    logger.error(result.reason);
                }
            });

            downloadAttachments(attachments, index + 1, resolve, reject);
        });
}

/**
 * Kicks off the batches for attachment downloads
 * @param {Object[]} attachments The attachments to download
 * @returns {Promise} A promise for when the attachments have been downloaded
 */
function downloadAllAttachments(attachments) {
    return new Promise(function (resolve, reject) {
        downloadAttachments(attachments, 0, resolve, reject);
    });
}

/**
 * Binds the functions with the connection
 * @param {Object} conn The Salesforce connection
 * @returns {Promise} A promise for when the variables are bound
 */
function bind(conn) {
    return new Promise(function (resolve) {
        logger.info('Binding functions');

        download_bound = downloadAttachment.bind(null, conn);
        resolve();
    });
}

/**
 * Gets the attachment data
 * @returns {Promise} A promise for the attachment data
 */
function getAttachmentData() {
    return new Promise(function (resolve, reject) {
        utils.readFile(attachment_path)
            .then(resolve)
            .catch(reject);
    });
}

/**
 * Gets the data and downloads the attachments
 * @returns {Promise} A promise for when everything is done
 */
function work() {
    return new Promise(function (resolve, reject) {
        getAttachmentData()
            .then(downloadAllAttachments)
            .then(resolve)
            .catch(reject);
    });
}

sfdc.login(config.salesforce.source)
    .then(bind)
    .then(work)
    .catch(utils.handleError);