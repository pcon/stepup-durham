const path = require('path');
const groupBy = require('lodash/groupBy');
const has = require('lodash/has');
const isEmpty = require('lodash/isEmpty');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const config = require('../config.json');

const logger = require('../lib/logger');
const utils = require('../lib/utils');
global.logger = utils.getLogger('match_contacts');

/**
 * Loads the old contacts from disk
 * @returns {Promise} A promise for when the contacts are loaded from disk
 */
function loadOldContacts() {
    return new Promise(function (resolve, reject) {
        const file_name = path.join(config.data.dir, config.data.contacts.old);
        logger.info(`Loading old contacts from ${file_name}`);
        utils.readFile(file_name)
            .then(function (oldContacts) {
                logger.info(`Got back ${oldContacts.length} contacts`);
                resolve(oldContacts);
            })
            .catch(reject);
    });
}

/**
 * Loads the new contacts from disk
 * @param {Object[]} oldContacts The contacts from the old system
 * @returns {Promise} A promise for when the contacts are loaded from disk
 */
function loadNewContacts(oldContacts) {
    return new Promise(function (resolve, reject) {
        const file_name = path.join(config.data.dir, config.data.contacts.new);
        logger.info(`Loading new contacts from ${file_name}`);
        utils.readFile(file_name)
            .then(function (newContacts) {
                logger.info(`Got back ${newContacts.length} contacts`);

                resolve({
                    old: oldContacts,
                    new: newContacts
                });
            })
            .catch(reject);
    });
}

/**
 * Maps the contacts to their email address
 * @param {Object} data The data
 * @returns {Promise} A promise for the mapped data
 */
function mapContacts(data) {
    return new Promise(function (resolve) {
        data.newMap = groupBy(data.new, 'Email');
        data.newMapName = {};

        data.new.forEach(function (contact) {
            if (!has(data.newMapName, contact.LastName)) {
                data.newMapName[contact.LastName] = {};
            }

            if (!has(data.newMapName[contact.LastName], contact.FirstName)) {
                data.newMapName[contact.LastName][contact.FirstName] = [];
            }

            data.newMapName[contact.LastName][contact.FirstName].push(contact);
        });
        resolve(data);
    });
}

/**
 * Finds the easy matches by email
 * @param {Object} data The contact data
 * @returns {Promise} A promise for the matched data
 */
function findEasyMatches(data) {
    return new Promise(function (resolve) {
        data.unmatchedContacts = [];
        data.matched = [];
        data.unclearContacts = [];

        data.old.forEach(function (contact) {
            if (!isEmpty(contact.Email) && has(data.newMap, contact.Email)) {
                if (data.newMap[contact.Email].length > 1) {
                    data.unclearContacts.push(contact);
                }
                contact.NewId = data.newMap[contact.Email][0].Id;
                data.matched.push(contact);
            } else if (isEmpty(contact.Email)) {
                if (
                    has(data.newMapName, contact.LastName) &&
                    has(data.newMapName[contact.LastName], contact.FirstName)
                ) {
                    if (data.newMapName[contact.LastName][contact.FirstName].length > 1) {
                        data.unclearContacts.push(contact);
                    }

                    contact.NewId = data.newMapName[contact.LastName][contact.FirstName][0].Id;
                    data.matched.push(contact);
                }
            } else {
                data.unmatchedContacts.push(contact);
            }
        });

        logger.info(`Unable to find ${data.unmatchedContacts.length} contacts`);
        logger.info(`Fuzzy match on ${data.unclearContacts.length} contacts`);

        resolve(data);
    });
}

/**
 * Writes CSV data to disk
 * @param {String} file_name The file name
 * @param {Object} data The data
 * @returns {Promise} A promise for when the data been written to disk
 */
function outputContactToCSV(file_name, data) {
    return new Promise(function (resolve, reject) {
        logger.info(`Writing ${data.length} contacts to ${file_name}`);

        const csvWriter = createCsvWriter({
            path: file_name,
            header: [
                {
                    id: 'Id',
                    title: 'Id'
                },
                {
                    id: 'Email',
                    title: 'Email'
                },
                {
                    id: 'FirstName',
                    title: 'FirstName'
                },
                {
                    id: 'LastName',
                    title: 'LastName'
                }
            ]
        });

        csvWriter.writeRecords(data)
            .then(function () {
                resolve(data);
            }).catch(reject);
    });
}

/**
 * Writes the unmatched contacts to disk
 * @param {Object} data contact data
 * @returns {Promise} A promise for when the unmatched contacts have been written to disk
 */
function outputUnmatched(data) {
    return new Promise(function (resolve, reject) {
        const file_name = utils.getOutputFile('unmatchedContacts', 'csv');

        outputContactToCSV(file_name, data.unmatchedContacts)
            .then(function () {
                resolve(data);
            })
            .catch(reject);
    });
}

/**
 * Writes the unclear contacts to disk
 * @param {Object} data contact data
 * @returns {Promise} A promise for when the unclear contacts have been written to disk
 */
function outputUnclear(data) {
    return new Promise(function (resolve, reject) {
        const file_name = utils.getOutputFile('unclearContacts', 'csv');

        outputContactToCSV(file_name, data.unclearContacts)
            .then(function () {
                resolve(data);
            })
            .catch(reject);
    });
}

/**
 * Writes the matched contacts to disk
 * @param {Object} data The contact data
 * @returns {Promise} A promise for when the matched contacts have been written
 */
function writeMatchedContacts(data) {
    return new Promise(function (resolve, reject) {
        const file_name = utils.getOutputFile('matchedContacts');

        utils.writeFile(file_name, data.matched)
            .then(function () {
                resolve(data);
            })
            .catch(reject);
    });
}

loadOldContacts()
    .then(loadNewContacts)
    .then(mapContacts)
    .then(findEasyMatches)
    .then(outputUnmatched)
    .then(outputUnclear)
    .then(writeMatchedContacts)
    .catch(utils.handleError)
    .finally(utils.exit);