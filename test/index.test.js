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
const Dynastar = require('../src').default;

assume.use(require('assume-sinon'));

const region = 'us-east-1';
const endpoint = 'http://localhost:4566';
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

  before(async function () {
    wrapped = new Dynastar({ model, hashKey, rangeKey });
    await liveness.waitForServices({
      clients: [dynamoDriver],
      waitSeconds: 60
    });
    
    await wrapped.ensureTable();
  });

  beforeEach(async function () {
    await wrapped.create({ hello: 'there' });
  });

  afterEach(async function () {
    const items = await wrapped.findAll({ }, true);
    await Promise.all(items.map(item => wrapped.remove(item)));
  });

  after(async function () {
    await wrapped.dropTable();
  });

  it('should support the datastar api interface', function () {
    assume(wrapped.create).is.an('asyncfunction');
    assume(wrapped.remove).is.an('asyncfunction');
    assume(wrapped.update).is.an('asyncfunction');
    assume(wrapped.findOne).is.an('asyncfunction');
    assume(wrapped.findAll).is.a('function');
    assume(wrapped.ensureTable).is.a('function');
    assume(wrapped.dropTable).is.a('function');
  });

  it('should call scan when no parameters are passed to findAll', async function () {
    sinon.spy(model, 'scan');

    const items = [];
    for await (const item of wrapped.findAll({})) {
      items.push(item);
    }
    
    assume(model.scan).is.called(1);
    assume(items).length(1);
  });

  it('should call query when hashKey is passed to findAll', async function () {
    sinon.spy(model, 'query');

    const items = [];
    wrapped.findAll({ hello: 'there' }, (err, res) => {
      assume(err).is.falsey();
      assume(model.query).is.called(1);
      assume(res).length(1);
      done();
    });
  });

  it('should be optional to pass parameter to findAll for scan', async function () {
    const stream = wrapped.findAll();

    const { value } = await stream.next();
    assume(value.hello).equals('there');
  });

  it('should catch table not found errors in findAll', async function () {
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

    let error;
    try {
      await myWrapped.findAll({ hello: 'world' }, true);
    } catch (err) {
      error = err;
    }

    assume(error).exists();
  });

  it('should emit table not found errors with streams in findAll', async function () {
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

    let error;
    try {
      for await (const item of stream) { }
    } catch (err) {
      error = err;
    }

    assume(error).exists();
  });

  it('should work with get with hash and rangeKey', async function () {
    const spec = { hello: 'what', what: id };
    await wrapped.create(spec);
    
    try {
      const res = await wrapped.findOne(spec);
      assume(spec).eql(res);  
    } finally {
      await wrapped.remove(spec);
    }
  });

  it('should work with update', async function () {
    const spec = { hello: 'what', what: id };
    await wrapped.create(spec);

    try {
      const res = await wrapped.findOne(spec);
      assume(spec).eql(res);
  
      await wrapped.update({ ...spec, another: 'key' });
      
      const findRes = await wrapped.findOne(spec);
      assume(findRes.another).equals('key');        
    } finally {
      await wrapped.remove(spec);
    }
  });
  
  describe('ensureTables', function () {
    it('can ensure tables multiple times without error', async function () {
      await wrapped.ensureTable();
      await wrapped.ensureTable();
    });

    it('yields an error when table cannot be created', async function () {
      // Invalid table name (too short and invalid characters)
      const myModel = dynamo.define('🛑🛑', {
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
      const myWrapped = new Dynastar({ model: myModel, hashKey, rangeKey });
      
      let error;
      try {
        await myWrapped.ensureTable();
      } catch (err) {
        error = err;
      }
      
      assume(error).to.exist();
      assume(error.message).to.include('Invalid table/index name');
      assume(error.code).to.equal('ValidationException');
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

    afterEach(async function () {
      if (myWrapped) {
        await myWrapped.dropTable();
      }
    });

    it('supports createKey for building the hash key', async function () {
      const spec = { hello: 'world', what: 'thing' };
      myWrapped = new Dynastar({
        model: myModel,
        hashKey: myHashKey,
        rangeKey: myRangeKey,
        createHashKey: ({ hello, what }) => `${hello}!${what}`
      });

      await myWrapped.ensureTable();
      await myWrapped.create(spec);
      
      const res = await myWrapped.findAll(spec, true);
      assume(res).length(1);

      const [result] = res;
      assume(result.key).equals('world!thing');
      assume(result.hello).equals('world');
      assume(result.what).equals('thing');
      await myWrapped.remove(spec);
    });

    it('supports createHashKey which overrides createKey for building the hash key', async function () {
      const spec = { hello: 'world', what: 'thing' };
      myWrapped = new Dynastar({
        model: myModel,
        hashKey: myHashKey,
        rangeKey: myRangeKey,
        createHashKey: ({ hello, what }) => `${hello}!${what}`
      });

      await myWrapped.ensureTable();

      await myWrapped.create(spec);

      try {
        const res = await myWrapped.findAll(spec, true);
        assume(res).length(1);
  
        const [result] = res;
        assume(result.key).equals('world!thing');
        assume(result.hello).equals('world');
        assume(result.what).equals('thing');  
      } finally {
        await myWrapped.remove(spec);
      }
    });

    it('supports createRangeKey for building the range key', async function () {
      const spec = { key: 'findMe', hello: 'world', other: 'something' };
      myWrapped = new Dynastar({
        model: myModel,
        hashKey: myHashKey,
        rangeKey: myRangeKey,
        createRangeKey: ({ hello, other }) => `${hello}!${other}`
      });

      await myWrapped.ensureTable();

      await myWrapped.create(spec);

      const res = await myWrapped.findAll(spec, true);
      assume(res).length(1);

      const [result] = res;
      assume(result.what).equals('world!something');
      await myWrapped.remove(spec);
    });
  });

  describe('options', function () {
    it('should be allowed on create', async function () {
      const spec = { hello: 'what', what: id };
      await wrapped.create(spec, { overwrite: false });
      
      let err;
      try {
        await wrapped.create(spec, { overwrite: false });
      } catch (error) {
        err = error;
      }

      assume(err).is.truthy();
      assume(err.message).to.equal('The conditional request failed');
    });

    it('should be allowed on update', async function () {
      const originalSpec = { hello: 'what', what: id, another: 'foo' };
      const updatedSpec = { ...originalSpec, another: 'bar' };

      await wrapped.create(originalSpec);
      const res = await wrapped.update(updatedSpec, { ReturnValues: 'ALL_OLD', expected: { another: 'foo' } });

      assume(res).is.truthy();
      assume(res.another).to.equal('foo');
    });

    it('should be allowed on remove', async function () {
      const spec = { hello: 'what', what: id };

      await wrapped.create({ ...spec, another: 'foo' });
      await wrapped.remove(spec, { expected: { another: 'foo' } });
    });

    it('should be allowed on findOne', async function () {
      const spec = { hello: 'what', what: id, another: 'foo' };

      await wrapped.create(spec);

      const res = await wrapped.findOne(spec, { ConsistentRead: true, AttributesToGet: ['hello', 'another'] });

      assume(res).is.truthy();
      assume(res).has.property('hello', 'what');
      assume(res).has.property('another', 'foo');
      assume(res).to.not.have.property('what');
    });
  });

  describe('Global Table attributes', function () {
    it('should strip out global table attributes on create', async function () {
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

      await wrapped.create(spec);
      
      const res = await wrapped.findOne(spec);
      
      assume(res).eql(expected);
      assume(res).not.to.have.property('aws:rep:deleting');
      assume(res).not.to.have.property('aws:rep:updatetime');
      assume(res).not.to.have.property('aws:rep:updateregion');
    });

    it('should strip out global table attributes on update', async function () {
      const spec = { hello: 'what', what: id };
      await wrapped.create(spec);
      
      try {
        const res = await wrapped.findOne(spec);
        assume(spec).eql(res);
        
        const updatedSpec = {
          ...spec,
          'another': 'key',
          'aws:rep:deleting': 'some-deleting value',
          'aws:rep:updatetime': 'some-update-time value',
          'aws:rep:updateregion': 'some-update-region value'
        };
        await wrapped.update(updatedSpec);
  
        const findRes = await wrapped.findOne(spec);
        assume(findRes.another).equals('key');
        assume(updatedSpec).to.have.property('aws:rep:deleting');
        assume(updatedSpec).to.have.property('aws:rep:updatetime');
        assume(updatedSpec).to.have.property('aws:rep:updateregion');  
      } finally {
        await wrapped.remove(spec);
      }
    });
  });
});
