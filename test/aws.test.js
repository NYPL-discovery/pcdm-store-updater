/* global describe it before after */

const assert = require('assert')
const kmsHelper = require('../lib/kms-helper')
const AWS = require('aws-sdk-mock')
const sinon = require('sinon')
const lambdaTester = require('lambda-tester')
const handler = require('../index.js').handler
const event = require('../event.json')
const KinesisWriter = require('../lib/KinesisWriter')

const getRDSString = (file) => {
  return require('dotenv').config({ path: `${file}` }).parsed['DISCOVERY_STORE_CONNECTION_URI']
}

describe('AWS', function () {
  this.timeout(5000)
  require('dotenv').config({ path: './.env' })

  describe('kmsHelper util', () => {
    it('should fail when there is no encrypted key', () => {
      process.env['DISCOVERY_STORE_CONNECTION_URI'] = ''
      try {
        kmsHelper.decryptDbCreds()
      } catch (e) {
        assert.equal(e.message, 'Missing DISCOVERY_STORE_CONNECTION_URI env variable; aborting.')
      }
    })

    it('should call decrypt the db uri', () => {
      process.env['DISCOVERY_STORE_CONNECTION_URI'] = getRDSString('./test.deploy.env')
      return kmsHelper.decryptDbCreds()
        .then(value => {
          assert.equal(value, 'postgresql://localhost:5432/discovery')
        })
    })
  })

  describe('Connecting to KMS for DB URI string', () => {
    var spyDecryptFunc

    before(() => {
      process.env['DISCOVERY_STORE_CONNECTION_URI'] = getRDSString('./deploy.env')
      spyDecryptFunc = sinon.spy()
      AWS.mock('KMS', 'decrypt', spyDecryptFunc)
    })

    it('should call kms.decrypt', () => {
      kmsHelper.decryptDbCreds()
      assert.equal(spyDecryptFunc.calledOnce, true)
    })

    after(() => AWS.restore('KMS', 'decrypt'))
  })

  describe('Connecting to Kinesis', () => {
    require('dotenv').config({ path: './deploy.env' })
    require('dotenv').config({ path: './.env' })
    var spyPutRecordsFunc

    before(() => {
      spyPutRecordsFunc = sinon.stub()
      AWS.mock('Kinesis', 'createStream', spyPutRecordsFunc)
      AWS.mock('Kinesis', 'describeStream')
      AWS.mock('Kinesis', 'putRecords', () => Promise.resolve(1))
    })

    it('should call Kinesis.putRecords from the KinesisWriter util', () => {
      // Must return the function since it's an asynchronous promise
      return (new KinesisWriter())
        // Mocking an array with one empty statement object
        .write({
          statements: [{
            subject_id: 'b10011745',
            predicate: 'dcterms:identifier',
            source_id: 10004,
            source_record_id: '10011745',
            creator_id: 1,
            index: 0,
            object_id: 'urn:bnum:10011745',
            source_record_path: 'id'
          }]
        })
        .then(() => {
          assert.equal(spyPutRecordsFunc.calledOnce, true)
        })
    })

    it('should call Kinesis.putRecords from the Lambda handler', () => {
      return lambdaTester(handler)
        .event(event)
        .expectResult((result) => {
          assert.equal(spyPutRecordsFunc.calledOnce, true)
        })
        .then(() => console.log('done?'))
    })

    after(() => AWS.restore('Kinesis', 'createStream'))
  })
})
