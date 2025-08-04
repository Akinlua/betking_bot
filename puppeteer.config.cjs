// comment out in dev
// we comment out this file in dev if not it looks for the wrong cacheDirectoryt
const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};

// const { join } = require('path');
// module.exports = {
//     cacheDirectory: process.env.NODE_ENV === 'production'
//         ? join(__dirname, '.cache', 'puppeteer')
//         : undefined
// };
