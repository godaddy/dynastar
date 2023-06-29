// Temporary until the maintainers of `@types/dynamodb` fix their declaration
// TODO: put pull request here

declare module 'dynamodb' {
  export class Item<T> extends EventEmitter {
    constructor(attrs: T, table: any);
    attrs: T;
    get<K extends keyof T>(key: K): T[K];
    set(attributes: Partial<T>): this;
    save(callback: Callback<T>): void;
    save(): Promise<T>;
    update(options: Model.UpdateOptions<T>, callback: Callback<Item<T>>): void;
    update(callback: Callback<Item<T>>): void;
    update(options?: Model.UpdateOptions<T>): Promise<Item<T>>;
    destroy(options: Model.DestroyOptions<T>, callback: Callback<Item<T>>): void;
    destroy(callback: Callback<Item<T>>): void;
    destroy(options?: Model.DestroyOptions<T>): Promise<Item<T>>;
    toJSON(): T;
  }

  export interface Model<T> {
    new(attrs: T): Item<T>;
    
    get(hashKey: string, rangeKey: string, options: Model.GetOptions<T>, callback: Callback<Item<T> | null>): void;
    get(hashKey: string, rangeKey: string, callback: Callback<Item<T> | null>): void;
    get(hashKey: string, options: Model.GetOptions<T>, callback: Callback<Item<T> | null>): void;
    get(hashKey: string, callback: Callback<Item<T> | null>): void;
    get(attributes: Partial<T>, options: Model.GetOptions<T>, callback: Callback<Item<T> | null>): void;
    get(attributes: Partial<T>, callback: Callback<Item<T> | null>): void;
    get(hashKey: string, rangeKey?: string, options?: Model.GetOptions<T>): Promise<Item<T> | null>;
    get(hashKey: string, options?: Model.GetOptions<T>): Promise<Item<T> | null>;
    get(attributes: Partial<T>, options?: Model.GetOptions<T>): Promise<Item<T> | null>;
    
    update(attributes: Partial<T>, options: Model.UpdateOptions<T>, callback: Callback<Item<T>>): void;
    update(attributes: Partial<T>, callback: Callback<Item<T>>): void;
    update(attributes: Partial<T>, options?: Model.UpdateOptions<T>): Promise<Item<T>>;

    create(attributes: Partial<T>, options: Model.CreateOptions, callback: Callback<Item<T>>): void;
    create(attributes: Partial<T>, callback: Callback<Item<T>>): void;
    create(attributes: Partial<T>, options?: Model.CreateOptions): Promise<Item<T>>;
    create(attributes: ReadonlyArray<Partial<T>>, options: Model.CreateOptions, callback: Callback<Array<Item<T>>>): void;
    create(attributes: ReadonlyArray<Partial<T>>, callback: Callback<Array<Item<T>>>): void;
    create(attributes: ReadonlyArray<Partial<T>>, options?: Model.CreateOptions): Promise<Array<Item<T>>>;

    destroy(hashKey: string, rangeKey: string, options: Model.DestroyOptions<T>, callback: Callback<any>): void;
    destroy(hashKey: string, rangeKey: string, callback: Callback<any>): void;
    destroy(hashKey: string, options: Model.DestroyOptions<T>, callback: Callback<any>): void;
    destroy(hashKey: string, callback: Callback<any>): void;
    destroy(attributes: Partial<T>, options: Model.DestroyOptions<T>, callback: Callback<any>): void;
    destroy(attributes: Partial<T>, callback: Callback<any>): void;
    destroy(hashKey: string, rangeKey?: string, options?: Model.DestroyOptions<T>): Promise<any>;
    destroy(hashKey: string, options?: Model.DestroyOptions<T>): Promise<any>;
    destroy(attributes: Partial<T>, options?: Model.DestroyOptions<T>): Promise<any>;
    
    getItems(keys: ReadonlyArray<Partial<T> | string>, options: Model.GetOptions<T>, callback: Callback<Array<Item<T>>>): void;
    getItems(keys: ReadonlyArray<Partial<T> | string>, callback: Callback<Array<Item<T>>>): void;
    getItems(keys: ReadonlyArray<Partial<T> | string>, options?: Model.GetOptions<T>): Promise<Array<Item<T>>>;

    query(hashKey: string): Query<T>;
    scan(): Scan<T>;
    parallelScan(totalSegments: number): ParallelScan<T>;

    createTable(options: object, callback: Callback<any>): void;

    deleteTable(callback: Callback<any>): void;
    deleteTable(): Promise<any>;

    before: (event: 'create' | 'update', hook: (data: Partial<T>, next: Callback<Partial<T>>) => void) => void;
    after: (event: 'create' | 'update' | 'destroy', hook: (data: Item<T>, next: Callback<void>) => void) => void;

    config(config: { dynamodb?: DynamoDB; tableName?: string }): any;
  }


  export interface WriteOptions {
    ReturnValues?: string | boolean;
  }

  export interface ConditionalOptions<T> {
    ConditionExpression?: any;
    ExpressionAttributeValues?: any;
    ExpressionAttributeNames?: any;
    expected?: Partial<T>;
  }

  export interface CreateOptions extends WriteOptions {
    overwrite?: boolean;
  }

  export interface UpdateOptions<T> extends ConditionalOptions<T>, WriteOptions {
    UpdateExpression?: any;
    ReturnValues?: string | boolean;
  }

  export interface DestroyOptions<T> extends ConditionalOptions<T>, WriteOptions {
  }

  export interface GetOptions<T> {
    ConsistentRead?: boolean;
    AttributesToGet?: Array<keyof T>;
    ProjectionExpression?: string;
  }

  interface QueryBase<T> {
    startKey(hashKey: string, rangeKey: string): this;
    limit(num: number): this;
    attributes(attrs: ReadonlyArray<keyof T> | keyof T): this;
    select(value: string): this;
    where<K extends keyof T>(keyName: keyof T): PredicateFor<T, K, this>;
    returnConsumedCapacity(value?: string): this;
    loadAll(): this;
    
    filterExpression(expression: string): this;
    addFilterCondition(condition: {
      attributeNames: Record<string, any>;
      attributeValues: Record<string, any>;
    }): this;

    projectionExpression(expression: string): this;

    expressionAttributeValues(valueMapping: Record<string, any>): this;
    expressionAttributeNames(nameMapping: Record<string, any>): this;

    exec: ExecuteFilter<Page<T>>;
    buildRequest(): any;
  }

  export interface Query<T> extends QueryBase<T> {
    usingIndex(name: string): this;
    consistentRead(read: boolean): this;

    addKeyCondition(condition: {
      attributeNames: Record<string, any>;
      attributeValues: Record<string, any>;
    }): this;

    ascending(): this;
    descending(): this;

    filter<K extends keyof T>(keyName: keyof T): PredicateFor<T, K, this>;
    
    buildKey(): string;
  }

  export interface Scan<T> extends QueryBase<T> {
    segments(segment: string, totalSegments: number): this;
  }

  export type ParallelScan<T> = Scan<T>;

  type PredicateFor<T, K extends keyof T, O extends QueryBase<T>>
    = T[K] extends Array<any> ? ArrayPredicate<T, T[K][number], O>
    : T[K] extends string ? StringPredicate<T, O>
    : Predicate<T, T[K], O>;

  interface Predicate<T, V, O extends QueryBase<T>> {
    equals: (value: V) => O;
    eq: (value: V) => O;
    ne: (value: V) => O;
    lte: (value: V) => O;
    lt: (value: V) => O;
    gte: (value: V) => O;
    gt: (value: V) => O;
    between: (...args: any[]) => O;
    exists: (exists?: boolean) => O;
    in: (...args: V[]) => O;
    null(): O;
    notNull(): O;
  }    

  interface ArrayPredicate<T, V, O extends QueryBase<T>>
    extends Predicate<T, V, O>
  {
    contains(value: V): O;
    notContains(value: V): O;
  }

  interface StringPredicate<T, O extends QueryBase<T>>
    extends Predicate<T, string, O>
  {
    beginsWith: (...args: any[]) => O;
  }

  export interface Page<T> {
    Items: Array<Item<T>>;
    Count: number;
    ScannedCount?: number;
    LastEvaluatedKey?: any;
    ConsumedCapacity?: {
      CapacityUnits: number;
      TableName: string;
    };
  }

  export const types: {
    stringSet: () => ArraySchema<string[]>;
    numberSet: () => ArraySchema<number[]>;
    binarySet: () => AnySchema;
    uuid: () => StringSchema;
    timeUUID: () => StringSchema;
  };

  export function dynamoDriver(driver?: DynamoDB): DynamoDB;
  export function define<T = any>(name: string, config: DefineConfig<T>): Model<T>;

  export type Callback<T> = (err: any, result: T) => void;
}