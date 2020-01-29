const { pipeline } = require('stream');
const through = require('through2');
const ls = require('list-stream');
const once = require('once');
const AwaitWrap = require('./await-wrap');

/**
 * Datastar API compatibility
 * @class
 */
class Dynastar {
  /**
   * @constructor
   * @param {Object} options Configuration
   *  @param {DynamoModel} options.model The dynamo model being wrappepd
   *  @param {String} [options.hashKey='key'] The hashKey of the model
   *  @param {String} [options.rangeKey] The rangeKey for the model
   *  @param {Function} [options.createKey] The function to create the hashKey for certain models
   */
  constructor({ model, hashKey = 'key', rangeKey, createKey, ...fns }) {
    this.model = model;
    this.hashKey = hashKey;
    this.rangeKey = rangeKey;
    this._createKey = createKey;

    // The idea of what we are doing here is to enable a way for functions to be
    // added to this class while also being able to track their name so other wrappers
    // like AwaitWrap can auto hoist them as well
    this.hoistable = Object.keys(fns);
    Object.assign(this, fns);
  }

  /**
   * @function create
   * @param {Object} data Model data object
   * @param {Function} callback Continuation function when finished
   * @returns {any} whatever the model returns
   */
  create(data, callback) {
    const opts = this._computeKeyOpts(data);
    return this.model.create(this._omitGlobalTableData({ ...opts, ...data }), callback);
  }

  /**
   * @function update
   * @param {Object} data Model data object
   * @param {Function} callback Continuation function when finished
   * @returns {any} whatever the model returns
   */
  update(data, callback) {
    const opts = this._computeKeyOpts(data);
    return this.model.update(this._omitGlobalTableData({ ...opts, ...data }), callback);
  }

  /**
   * @function remove
   * @param {Object} data Model data object
   * @param {Function} callback Continuation function when finished
   * @returns {any} whatever the model returns
   */
  remove(data, callback) {
    const opts = this._computeKeyOpts(data);
    return this.model.destroy(opts, callback);
  }

  /**
   * @function get
   * @param {Object} data Model data object
   * @param {Function} callback Continuation function when finished
   * @returns {any} whatever the model returns
   */
  get(data, callback) {
    const opts = this._computeKeyOpts(data);
    return this.model.get(opts, (err, res) => {
      callback(err, res && res.toJSON());
    });
  }

  /**
   * @function findOne
   * @param {Object} data Model data object
   * @returns {any} whatever get returns
   */
  findOne() {
    return this.get(...arguments);
  }

  /**
   * @function findAll
   * @param {Object} data Datastar find object or model data object
   * @param {Function} [callback] Continuation function when finished
   * @returns {Stream} stream with results
   */
  findAll(data = {}, callback) {
    let conditions, fields;
    if (data.conditions) conditions = data.conditions;
    if (data.fields) fields = data.fields;

    conditions = conditions || data;

    let opts, key;
    if (Object.keys(conditions).length) {
      opts = this._computeKeyOpts(conditions);
      key = opts[this.hashKey];
    }

    const query = key ? this.model.query(key) : this.model.scan();
    if (fields) query.attributes(fields);

    return this.findAllQuery(query, callback);
  }

  /**
   * Safely runs a query (or table scan).
   * This is useful when you need to query a secondary indexes and want our default item parsing logic.
   *
   * @function findAllQuery
   * @param {Object} query A DynamoDB model query or scan object to execute
   * @param {Function} [callback] Continuation function when finished
   * @returns {Stream} Stream with results
   */
  findAllQuery(query, callback) {
    if (callback) {
      callback = once(callback);
    }

    // These models are weird and don't even have proper getters so we have to
    // just use it as raw json so we can expect the object to have
    // properties
    const rawStream = query.loadAll().exec();
    const throughStream = through.obj(function (res, enc, cb) {
      res = res.Items || res;
      for (const d of res) {
        this.push(d && d.toJSON());
      }
      cb();
    });

    if (callback) {
      const lsStream = ls.obj(callback);
      pipeline(
        rawStream,
        throughStream,
        lsStream,
        function (error) {
          if (error) return callback(error);
        }
      );
      return lsStream;
    }

    pipeline(
      rawStream,
      throughStream,
      function (error) {
        // Need to re-emit the caught error on the result stream
        if (error) {
          throughStream.emit('error', error);
        }
      }
    );
    return throughStream;
  }

  /**
   *  @function ensureTables
   *  @returns {any} whatever the model returns
   */
  ensureTables() {
    return this.model.createTable(...arguments);
  }

  /**
   * @function dropTables
   * @returns {any} whatever the model returns
   */
  dropTables() {
    return this.model.deleteTable(...arguments);
  }

  /**
   * @function _computeKeyOpts
   * @param {Object} data Parameters for given model
   * @returns {Object} parameters for hashKey and/or rangeKey
   */
  _computeKeyOpts(data) {
    const ret = this._createKey
      ? { key: this._createKey(data) }
      : { [this.hashKey]: data[this.hashKey] };

    if (this.rangeKey && data[this.rangeKey]) {
      ret[this.rangeKey] = data[this.rangeKey];
    }

    return ret;
  }

  /**
   * Removes attributes that are created by Global Tables and should never be written.
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables_HowItWorks.html
   * @param {Object} data The model data
   * @returns {Object} The model data without the global-table attributes
   */
  _omitGlobalTableData(data) {
    delete data['aws:rep:deleting'];
    delete data['aws:rep:updatetime'];
    delete data['aws:rep:updateregion'];
    return data;
  }
}


module.exports = Dynastar;
module.exports.AwaitWrap = AwaitWrap;
module.exports.Dynastar = Dynastar;
