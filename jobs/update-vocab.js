'use strict'

const VocabUpdater = require('../lib/controlled-vocab-updaters')
const log = require('loglevel')

var argv = require('optimist')
  .usage('Usage: $0 [--offset=num] [--limit=num]')
  .describe('offset', 'Start at index')
  .describe('limit', 'Limit to this number of records')
  .describe('loglevel', 'Specify log level (default error)')
  .argv

log.setLevel(argv.loglevel || 'error')

function error (what) {
  console.log(what)
  process.exit()
}

var vocab = argv._[0]
if (['locations', 'statuses'].indexOf(vocab) < 0) {
  error('Must specify vocab to update')
}

; (new VocabUpdater(vocab)).update(argv.offset, argv.limit)
