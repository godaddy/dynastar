///<reference types="../src/extensions.d.ts"/>

import { omit } from 'lodash';
import type { CreateOptions, DestroyOptions, GetOptions, Model, UpdateOptions } from 'dynamodb';

export type DynastarConfig<
  T,
  HashKey extends keyof T,
  RangeKey extends keyof T | never
> = {
  /** The dynamo model being wrapped */
  model: Model<T>,
  
  /** The hashKey of the model. */
  hashKey: HashKey,
  /** Function to create the hashKey value from model data */
  createHashKey?: (data: Omit<Partial<T>, HashKey | RangeKey>) => T[HashKey],

  /** The rangeKey for the model */
  rangeKey?: RangeKey,
  /** The function to create the rangeKey value from model data */
  createRangeKey?: (data: Omit<Partial<T>, HashKey | RangeKey>) => T[RangeKey],
}

const metadataFields = [
  'aws:rep:deleting',
  'aws:rep:updatetime',
  'aws:rep:updateregion'
] as const;

/** Datastar API compatibility */
class Dynastar<T, HashKey extends keyof T, RangeKey extends keyof T | never = never> {
  model: Model<T>;
  hashKey: keyof T;
  rangeKey?: keyof T;
  
  private _createHashKey?: (data: Omit<Partial<T>, HashKey | RangeKey>) => T[HashKey];
  private _createRangeKey?: (data: Omit<Partial<T>, HashKey | RangeKey>) => T[RangeKey];

  /** Creates a Dynastar wrapper around a dynamodb model */
  constructor({
    model,
    hashKey,
    rangeKey,
    createHashKey,
    createRangeKey
  }: DynastarConfig<T, HashKey, RangeKey>) {
    this.model = model;
    this.hashKey = hashKey;
    this.rangeKey = rangeKey;
    this._createHashKey = createHashKey;
    this._createRangeKey = createRangeKey;
  }

  /** Stores a new item in the table */
  async create(
    data: Partial<T>,
    options?: CreateOptions
  ): Promise<T> {
    const created = await this.model.create(this.prepareAttributes(data), options);
    return created?.toJSON();
  }

  /** Modifies an item in the table
   * @function update
   * @param {Object} data Model data object
   * @param {Object} [options] Optional options object
   * @param {Function} callback Continuation function when finished
   * @returns {any} whatever the model returns
   */
  async update(
    data: Partial<T>,
    options?: UpdateOptions<T>
  ): Promise<T> {
    const updated = await this.model.update(this.prepareAttributes(data), options);
    return updated.toJSON();
  }

  /** Deletes an item from the table */
  async remove(
    keys: Partial<T>,
    options?: DestroyOptions<T>
  ): Promise<void> {
    await this.model.destroy(this.prepareAttributes(keys), options);
  }

  /** Fetches an item from the table */
  async findOne(
    keys: Partial<T>,
    options?: GetOptions<T>
  ): Promise<T | null> {
    const attributes = this.prepareAttributes(keys);
    
    // There's a bug in dynamodb for parameter handling when both an attributes
    // object and options object are passed in. Extract the keys instead.
    const args = [
      attributes[this.hashKey],
      this.rangeKey && attributes[this.rangeKey],
      options
    ].filter(Boolean) as Parameters<typeof this.model.get>;
    const item = await this.model.get(...args);
    return item?.toJSON() ?? null;
  }

  /** Fetches or streams all matching items from the table */
  findAll(keys?: Partial<T>, asArray?: false): AsyncIterable<T>;
  findAll(keys: Partial<T>, asArray: true): Promise<Array<T>>;
  findAll(options?: { conditions: Partial<T>, fields: Array<keyof T> }, asArray?: false): AsyncIterable<T>;
  findAll(options: { conditions: Partial<T>, fields: Array<keyof T> }, asArray: true): Promise<Array<T>>;
  findAll<Fields extends (keyof T) & string>(
    keysOrConditions: { conditions: Partial<T>, fields?: Array<Fields> } | Partial<T> = {},
    asArray = false
  ): AsyncIterable<T> | Promise<Array<T>> {
    const query = this.query(keysOrConditions);
    return asArray ? collect(query) : query;
  }

  private async *query<Fields extends (keyof T) & string>(
    keysOrConditions: { conditions: Partial<T>, fields?: Array<Fields> } | Partial<T>
  ): AsyncIterable<T> {
    let conditions: Partial<T>, fields: Array<Fields> | undefined;
    if ('conditions' in keysOrConditions) {
      conditions = keysOrConditions.conditions;
      fields = keysOrConditions.fields;
    } else {
      conditions = keysOrConditions;
    }

    let key;
    if (Object.keys(conditions).length) {
      conditions = this.prepareAttributes(conditions)
      key = conditions[this.hashKey];
    }

    const query = typeof key === 'string'
      ? this.model.query(key)
      : this.model.scan();
    if (fields) query.attributes(fields);

    for await (const page of query.loadAll().exec()) {
      for (const item of page.Items) {
        yield item.toJSON();
      }
    }
  }

  /** Creates the underlying table if it doesn't already exist */
  ensureTable(options?: any) {
    // `createTable` doesn't have a Promise variant like the other methods
    return new Promise((resolve, reject) => {
      return this.model.createTable(options || {}, function (err, data) {
        if (err && err.code !== 'ResourceInUseException' && err.message !== 'Table already created') {
          return void reject(err);
        }
        
        resolve(data);
      });  
    })
  }

  /** Deletes the underlying table */
  dropTable() {
    return this.model.deleteTable();
  }

  private prepareAttributes(data: Partial<T>): Partial<T> {
    return {
      ...(this._createHashKey
        ? { [this.hashKey]: this._createHashKey(data) }
        : {}),
      ...(this._createRangeKey && this.rangeKey
        ? { [this.rangeKey]: this._createRangeKey(data) }
        : {}),
      ...omit(data, ...metadataFields)
    } as Partial<T>;
  }
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<Array<T>> {
  const result: Array<T> = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}

export default Dynastar;
