'use strict';

const pino = require('pino');

// Plain pino (JSON to stdout). The entry scripts also print friendly console
// lines for humans running this on the Vchemics PC.
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

module.exports = { logger };
