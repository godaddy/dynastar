const thenify = require('tinythen');
const toString = Object.prototype.toString;

/**
 * The beginning experiment for async/await support for Datastar models.
 * We use this class to wrap each model and the used methods with thenables.
 * We also create a new method so we can still support streaming for findAll
 *
 * @class AwaitWrap
 */
class AwaitWrap {
  /**
   * Initialize instance with model
   *
   * @param {Dynastar} model A defined dynamodb model wrapper Dynastar
   * @constructor
   */
  constructor(model) {
    this.model = model;
    this._hoist(model);
  }
  /**
   * Hoist any labeled hoistable functions found on the Dynastar compatibility wrapper
   *
   * @param {Dynastar} model A defined dynamodb model wrapper Dynastar
   */
  _hoist(model) {
    if (model.hoistable && model.hoistable.length) {
      for (const name of model.hoistable) {
        const fn = model[name];
        // Here we basically assume that unless its already an async function
        //  its callback based and we thenify it
        if (!isAsyncFn(fn) && fn.length >= 2) {
          this[name] = function () {
            return thenify(model, name, ...arguments);
          };
        } else {
          this[name] = fn.bind(model);
        }
      }
    }

  }
  /**
   * Thenable wrap the create method
   *
   * @function create
   * @returns {Thenable} wrapped result
   */
  create() {
    return thenify(this.model, 'create', ...arguments);
  }

  /**
   * Thenable wrap the update method
   *
   * @function update
   * @returns {Thenable} wrapped result
   */
  update() {
    return thenify(this.model, 'update', ...arguments);
  }

  /**
   * Thenable wrap the remove method
   *
   * @function remove
   * @returns {Thenable} wrapped result
   */
  remove() {
    return thenify(this.model, 'remove', ...arguments);
  }

  /**
   * Thenable wrap the findOne method
   *
   * @function findOne
   * @returns {Thenable} wrapped result
   */
  findOne() {
    return thenify(this.model, 'findOne', ...arguments);
  }
  /**
   * Thenable wrap the get method
   *
   * @function get
   * @returns {Thenable} wrapped result
   */
  get() {
    return this.findOne(...arguments);
  }
  /**
   * Return the normal model findAll for the stream
   * @function findAllStream
   * @returns {Stream} of results
   */
  findAllStream() {
    // Dont wrap this one since it can return a stream that we may want to leverage
    return this.model.findAll(...arguments);
  }

  /**
   * Thenable wrap the findAll method
   *
   * @function findAll
   * @returns {Thenable} wrapped result
   */
  findAll() {
    return thenify(this.model, 'findAll', ...arguments);
  }

  /**
   * Thenable wrap the ensureTables method
   *
   * @function ensure
   * @returns {Thenable} wrapped result
   */
  ensure() {
    return thenify(this.model, 'ensureTables');
  }
  /**
   * Thenable wrap the ensureTables method
   *
   * @function ensureTables
   * @returns {Thenable} wrapped result
   */
  ensureTables() {
    return this.ensure();
  }

  /**
   * Thenable wrap the dropTables method
   *
   * @function drop
   * @returns {Thenable} wrapped result
   */
  drop() {
    return thenify(this.model, 'dropTables');
  }
  /**
   * Thenable wrap the dropTables method
   *
   * @function drop
   * @returns {Thenable} wrapped result
   */
  dropTables() {
    return this.drop();
  }
}

module.exports = AwaitWrap;

/**
 * @function isAsyncFn
 * @param {Function} fn Function to check type of
 * @returns {Boolean} true/false
 */
function isAsyncFn(fn) {
  return toString.call(fn).toLowerCase().slice(8, -1) === 'asyncfunction';
}
