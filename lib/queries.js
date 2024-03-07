const lodash = require('lodash');

const utils = require('./utils');

const CONTACT = 'Contact';
const DURHAM = 'Durham';
const CONTACT_FIELDS = [
    'Id',
    'Email',
    'FirstName',
    'LastModifiedDate',
    'LastName'
];

const NOTE = 'Note';
const NOTE_FIELDS = [
    'Id',
    'Body',
    'IsPrivate',
    'OwnerId',
    'ParentId',
    'Title'
];

const ATTACHMENT = 'Attachment';
const ATTACHMENT_FIELDS = [
    'Id',
    'Body',
    'BodyLength',
    'ContentType',
    'Description',
    'IsPrivate',
    'Name',
    'OwnerId',
    'ParentId'
];

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
 * Gets the Durham based contacts from the old system
 * @returns {String} The query for the Durham contacts
 */
function getDurhamContacts() {
    return generateQuery(CONTACT_FIELDS, CONTACT, `Account.Site__c = '${DURHAM}'`);
}

/**
 * Gets all the contacts
 * @returns {String} The query for the Durham contacts
 */
function getAllContacts() {
    return generateQuery(CONTACT_FIELDS, CONTACT);
}

/**
 * Gets all the notes for a list of contact ids
 * @param {String[]} contact_ids The contacts to get the notes for
 * @return {String} The query for the notes
 */
function getNotesForContacts(contact_ids) {
    const where_clause = `ParentId in (${utils.quoteStrings(contact_ids).join(',')})`;

    return generateQuery(NOTE_FIELDS, NOTE, where_clause);
}

/**
 * Gets all the attachments for a list of contact ids
 * @param {String[]} contact_ids The contacts to get the attachments for
 * @return {String} The query for the attachments
 */
function getAttachmentsForContacts(contact_ids) {
    const where_clause = `ParentId in (${utils.quoteStrings(contact_ids).join(',')})`;

    return generateQuery(ATTACHMENT_FIELDS, ATTACHMENT, where_clause);
}

module.exports = {
    contact: {
        durham: getDurhamContacts,
        all: getAllContacts,
        notes: getNotesForContacts,
        attachments: getAttachmentsForContacts
    },
    generateQuery: generateQuery
};