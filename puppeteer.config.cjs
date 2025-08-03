const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    cacheDirectory: process.env.NODE_ENV === 'production'
        ? join(__dirname, '.cache', 'puppeteer')
        : undefined
};