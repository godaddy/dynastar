/* eslint max-nested-callbacks: ["error", 10]*/
const assume = require('assume');
const async = require('async');
const dynamo = require('dynamodb-x');
const { DynamoDB } = require('aws-sdk');
const AwsLiveness = require('aws-liveness');
const sinon = require('sinon');
const Joi = require('joi');
const uuid = require('uuid');
const { Dynastar, AwaitWrap } = require('..');

assume.use(require('assume-sinon'));

const region = 'us-east-1';
const endpoint = 'http://localhost:4569';
// Need to set some values for these for it to actually work
process.env.AWS_ACCESS_KEY_ID = 'foobar';
process.env.AWS_SECRET_ACCESS_KEY = 'foobar';

const dynamoDriver = new DynamoDB({ endpoint, region });
const liveness = new AwsLiveness();
dynamo.dynamoDriver(dynamoDriver);

describe('Dynastar - index.js', function () {
  this.timeout(6E4);
  let wrapped;
  const id = uuid.v1();
  const hashKey = 'hello';
  const rangeKey = 'what';
  const model = dynamo.define('test', {
    hashKey,
    rangeKey,
    schema: {
      hello: Joi.string(),
      what: dynamo.types.timeUUID(),
      another: Joi.string().allow(null)
    }
  });

  before(function (done) {
    wrapped = new Dynastar({ model, hashKey, rangeKey });
    liveness.waitForServices({
      clients: [dynamoDriver],
      waitSeconds: 60
    }).then(() => wrapped.ensureTables(done))
      .catch(done);
  });

  beforeEach(function (done) {
    wrapped.create({ hello: 'there' }, done);
  });

  afterEach(function (done) {
    wrapped.findAll({ hello: 'there' }, (err, result) => {
      if (err) return done(err);
      async.each(result, wrapped.remove.bind(wrapped), done);
    });
  });

  after(function (done) {
    wrapped.dropTables(done);
  });

  it('should support the datastar api interface', function () {
    assume(wrapped.create).is.a('function');
    assume(wrapped.remove).is.a('function');
    assume(wrapped.update).is.a('function');
    assume(wrapped.findOne).is.a('function');
    assume(wrapped.findAll).is.a('function');
    assume(wrapped.get).is.a('function');
    assume(wrapped.ensureTables).is.a('function');
    assume(wrapped.dropTables).is.a('function');
  });

  it('should call scan when no parameters are passed to findAll', function (done) {
    sinon.spy(model, 'scan');

    wrapped.findAll({}, (err, res) => {
      assume(err).is.falsey();
      assume(model.scan).is.called(1);
      assume(res).length(1);
      done();
    });
  });

  it('should call query when hashKey is passed to findAll', function (done) {
    sinon.spy(model, 'query');

    wrapped.findAll({ hello: 'there' }, (err, res) => {
      assume(err).is.falsey();
      assume(model.query).is.called(1);
      assume(res).length(1);
      done();
    });
  });

  it('should be optional to pass parameter to findAll for scan', function (done) {
    const stream = wrapped.findAll();

    stream.on('data', function (data) {
      assume(data.hello).equals('there');
    }).on('end', done);
  });

  it('should work with get with hash and rangeKey', function (done) {
    const spec = { hello: 'what', what: id };
    wrapped.create(spec, (err) => {
      assume(err).is.falsey();
      wrapped.get(spec, (err, res) => {
        assume(err).is.falsey();
        assume(spec).eql(res);
        wrapped.remove(spec, done);
      });
    });
  });

  it('should work with update', function (done) {
    const spec = { hello: 'what', what: id };
    wrapped.create(spec, (err) => {
      assume(err).is.falsey();
      wrapped.get(spec, (err, res) => {
        assume(err).is.falsey();
        assume(spec).eql(res);
        wrapped.update({ ...spec, another: 'key' }, (err) => {
          assume(err).is.falsey();
          wrapped.findOne(spec, (err, res) => {
            assume(err).is.falsey();
            assume(res.another).equals('key');
            wrapped.remove(spec, done);
          });
        });
      });
    });
  });

  describe('hoistable functions', function () {
    it('should work with defined hoistable function', function (done) {
      function modify(obj) {
        obj.anotherKey = 'what';
        return obj;
      }

      const wmodel = new Dynastar({ model, hashKey, rangeKey, modify });
      assume(wmodel.modify).is.a('function');
      wmodel.findAll()
        .on('data', function (data) {
          const modified = wmodel.modify(data);
          assume(modified.anotherKey).equals('what');
        })
        .on('error', done)
        .on('end', done);
    });

    it('should hoist function with AwaitWrap and make them awaitable', async function () {
      function somethingAsync(data, done) {
        data.somethingAsync = true;
        return void setImmediate(done, null, data);
      }
      const wmodel = new AwaitWrap(new Dynastar({ model, hashKey, rangeKey, somethingAsync }));
      const results = await wmodel.findAll({ hello: 'there' });
      for (const res of results) {
        const modified = await wmodel.somethingAsync(res);
        assume(modified.somethingAsync).is.true();
      }
    });
  });
});
