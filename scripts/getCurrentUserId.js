const sfdc = require('../lib/sfdc');

const logger = require('../lib/logger');
const utils = require('../lib/utils');
global.logger = utils.getLogger('getCurrentUserId');

/**
 * Gets the current user Id from the connection
 * @param {Object} conn The Salesforce connection
 * @returns {Promise} A promise for the user id is printed
 */
function getUserId(conn) {
    return new Promise(function (resolve) {
        logger.info('Getting the user id');

        logger.info(`Current id: ${conn.userInfo.id}`);

        resolve();
    });
}

sfdc.login('durham')
    .then(getUserId)
    .catch(utils.handleError)
    .finally(utils.exit);