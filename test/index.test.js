/* eslint
  max-nested-callbacks: ["error", 10],
  max-statements: 0,
  no-process-env: 0
*/
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
    },
    indexes: [{
      name: 'ByIndex',
      hashKey: 'another',
      type: 'global'
    }]
  });

  function findByIndex(data, callback) {
    const { another, hello } = data;

    let query = this.model.query(another).usingIndex('ByIndex');
    if (hello) query = query.where('hello').equals(hello);

    this.findAllQuery(query, callback);
  }

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
    wrapped.findAll({ }, (err, result) => {
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

  it('should catch table not found errors in findAll', function (done) {
    const myHashKey = 'hello';
    const myModel = dynamo.define('badTable', {
      hashKey,
      rangeKey,
      schema: {
        hello: Joi.string(),
        world: Joi.string().allow(null)
      }
    });

    const myWrapped = new Dynastar({
      model: myModel,
      hashKey: myHashKey
    });

    myWrapped.findAll({
      hello: 'world'
    }, (error) => {
      assume(error).is.truthy();
      done();
    });
  });

  it('should emit table not found errors with streams in findAll', function (done) {
    const myHashKey = 'hello';
    const myModel = dynamo.define('badTable', {
      hashKey,
      rangeKey,
      schema: {
        hello: Joi.string(),
        world: Joi.string().allow(null)
      }
    });

    const myWrapped = new Dynastar({
      model: myModel,
      hashKey: myHashKey
    });

    const stream = myWrapped.findAll({
      hello: 'world'
    });

    stream
      .on('data', function () {
        done(new Error('Unexpected received data instead of error.'));
      })
      .on('error', function (error) {
        assume(error).is.truthy();
      })
      .on('close', done);
  });

  it('should work with get with hash and rangeKey', function (done) {
    const spec = { hello: 'what', what: id };
    wrapped.create(spec, (err) => {
      assume(err).is.falsey();
      wrapped.get(spec, (getErr, res) => {
        assume(getErr).is.falsey();
        assume(spec).eql(res);
        wrapped.remove(spec, done);
      });
    });
  });

  it('should work with update', function (done) {
    const spec = { hello: 'what', what: id };
    wrapped.create(spec, (err) => {
      assume(err).is.falsey();
      wrapped.get(spec, (getErr, res) => {
        assume(getErr).is.falsey();
        assume(spec).eql(res);
        wrapped.update({ ...spec, another: 'key' }, (updateErr) => {
          assume(updateErr).is.falsey();
          wrapped.findOne(spec, (findErr, findRes) => {
            assume(findErr).is.falsey();
            assume(findRes.another).equals('key');
            wrapped.remove(spec, done);
          });
        });
      });
    });
  });

  describe('key builders', function () {
    let myModel, myHashKey, myRangeKey, myWrapped;

    before(function () {
      myHashKey = 'key';
      myRangeKey = 'what';

      myModel = dynamo.define('test2', {
        hashKey: myHashKey,
        rangeKey: myRangeKey,
        schema: {
          key: Joi.string(),
          hello: Joi.string(),
          what: Joi.string(),
          other: Joi.string().allow(null)
        }
      });
    });

    afterEach(function (done) {
      if (myWrapped) {
        myWrapped.dropTables(done);
      } else {
        done();
      }
    });

    it('supports createKey for building the hash key', function (done) {
      const spec = { hello: 'world', what: 'thing' };
      myWrapped = new Dynastar({
        model: myModel,
        hashKey: myHashKey,
        rangeKey: myRangeKey,
        createKey: ({ hello, what }) => `${hello}!${what}`
      });

      myWrapped.ensureTables(() => {
        myWrapped.create(spec, (err) => {
          assume(err).is.falsey();
          myWrapped.findAllQuery(myWrapped.model.query('world!thing'),  (getErr, res) => {
            assume(getErr).is.falsey();
            assume(res).length(1);

            const [result] = res;
            assume(result.key).equals('world!thing');
            assume(result.hello).equals('world');
            assume(result.what).equals('thing');
            myWrapped.remove(spec, done);
          });
        });
      });
    });

    it('supports createHashKey which overrides createKey for building the hash key', function (done) {
      const spec = { hello: 'world', what: 'thing' };
      myWrapped = new Dynastar({
        model: myModel,
        hashKey: myHashKey,
        rangeKey: myRangeKey,
        createHashKey: ({ hello, what }) => `${hello}!${what}`,
        // overrides createKey
        createKey: ({ hello, what }) => `${what}!${hello}`
      });

      myWrapped.ensureTables(() => {
        myWrapped.create(spec, (err) => {
          assume(err).is.falsey();
          myWrapped.findAllQuery(myWrapped.model.query('world!thing'),  (getErr, res) => {
            assume(getErr).is.falsey();
            assume(res).length(1);

            const [result] = res;
            assume(result.key).equals('world!thing');
            assume(result.hello).equals('world');
            assume(result.what).equals('thing');
            myWrapped.remove(spec, done);
          });
        });
      });
    });

    it('supports createRangeKey for building the range key', function (done) {
      const spec = { key: 'findMe', hello: 'world', other: 'something' };
      myWrapped = new Dynastar({
        model: myModel,
        hashKey: myHashKey,
        rangeKey: myRangeKey,
        createRangeKey: ({ hello, other }) => `${hello}!${other}`
      });

      myWrapped.ensureTables(() => {
        myWrapped.create(spec, (err) => {
          assume(err).is.falsey();
          myWrapped.findAllQuery(myWrapped.model.query('findMe'),  (getErr, res) => {
            assume(getErr).is.falsey();
            assume(res).length(1);

            const [result] = res;
            assume(result.what).equals('world!something');
            myWrapped.remove(spec, done);
          });
        });
      });
    });
  });

  describe('options', function () {
    it('should be allowed on create', function (done) {
      const spec = { hello: 'what', what: id };
      wrapped.create(spec, { overwrite: false }, function (initialError) {
        assume(initialError).to.be.falsey();

        wrapped.create(spec, { overwrite: false }, function (err) {
          assume(err).is.truthy();
          assume(err.message).to.equal('The conditional request failed');
          done();
        });
      });
    });

    it('should be allowed on update', function (done) {
      const originalSpec = { hello: 'what', what: id, another: 'foo' };
      const updatedSpec = { ...originalSpec, another: 'bar' };

      wrapped.create(originalSpec, function (initialError) {
        assume(initialError).to.be.falsey();

        wrapped.update(updatedSpec, { ReturnValues: 'ALL_OLD', expected: { another: 'foo' } }, function (err, res) {
          assume(err).is.falsey();
          assume(res).is.truthy();
          assume(res.toJSON().another).to.equal('foo');
          done();
        });
      });
    });

    it('should be allowed on remove', function (done) {
      const spec = { hello: 'what', what: id };

      wrapped.create({ ...spec, another: 'foo' }, function (initialError) {
        assume(initialError).to.be.falsey();

        wrapped.remove(spec, { expected: { another: 'foo' } }, function (err) {
          assume(err).is.falsey();
          done();
        });
      });
    });

    it('should be allowed on get', function (done) {
      const spec = { hello: 'what', what: id, another: 'foo' };

      wrapped.create(spec, function (initialError) {
        assume(initialError).to.be.falsey();

        wrapped.get(spec, { ConsistentRead: true, AttributesToGet: ['hello', 'another'] }, function (err, res) {
          assume(err).is.falsey();
          assume(res).is.truthy();
          assume(res).has.property('hello', 'what');
          assume(res).has.property('another', 'foo');
          assume(res).to.not.have.property('what');
          done();
        });
      });
    });
  });

  describe('Global Table attributes', function () {
    it('should strip out global table attributes on create', function (done) {
      const spec = {
        'hello': 'what',
        'what': id,
        'aws:rep:deleting': 'some-deleting value',
        'aws:rep:updatetime': 'some-update-time value',
        'aws:rep:updateregion': 'some-update-region value'
      };
      const expected = {
        hello: spec.hello,
        what: spec.what
      };

      wrapped.create(spec, (err) => {
        assume(err).is.falsey();
        wrapped.get(spec, (getErr, res) => {
          assume(getErr).is.falsey();
          assume(res).eql(expected);

          assume(spec).to.have.property('aws:rep:deleting');
          assume(spec).to.have.property('aws:rep:updatetime');
          assume(spec).to.have.property('aws:rep:updateregion');
          wrapped.remove(res, done);
        });
      });
    });

    it('should strip out global table attributes on update', function (done) {
      const spec = { hello: 'what', what: id };
      wrapped.create(spec, (err) => {
        assume(err).is.falsey();
        wrapped.get(spec, (getErr, res) => {
          assume(getErr).is.falsey();
          assume(spec).eql(res);
          const updatedSpec = {
            ...spec,
            'another': 'key',
            'aws:rep:deleting': 'some-deleting value',
            'aws:rep:updatetime': 'some-update-time value',
            'aws:rep:updateregion': 'some-update-region value'
          };
          wrapped.update(updatedSpec, (updateErr) => {
            assume(updateErr).is.falsey();
            wrapped.findOne(spec, (findErr, findRes) => {
              assume(findErr).is.falsey();
              assume(findRes.another).equals('key');
              assume(updatedSpec).to.have.property('aws:rep:deleting');
              assume(updatedSpec).to.have.property('aws:rep:updatetime');
              assume(updatedSpec).to.have.property('aws:rep:updateregion');
              wrapped.remove(spec, done);
            });
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

    it('should allow query by index', function (done) {
      const wmodel = new Dynastar({ model, hashKey, rangeKey, findByIndex });
      assume(wmodel.findByIndex).is.a('function');

      wmodel.create({ hello: 'bob', another: 'foo' }, (error) => {
        if (error) return done(error);

        wmodel.create({ hello: 'cruel world', another: 'foo' }, (error2) => {
          if (error2) return done(error2);

          wmodel.findByIndex({ another: 'foo' }, (findError, results) => {
            if (findError) return done(findError);

            assume(results).to.have.length(2);
            const hellos = results.map(r => r.hello);
            assume(hellos).contains('bob');
            assume(hellos).contains('cruel world');
            done();
          });
        });
      });
    });
  });
});
