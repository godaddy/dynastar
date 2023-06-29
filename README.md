# dynastar
[![Build Status](https://travis-ci.com/godaddy/dynastar.svg?branch=master)](https://travis-ci.com/godaddy/dynastar)

A simple compatibility layer for dynamodb models to be similar to the datastar model API

## Install

```bash
npm install dynastar --save
```

## Usage

When defining your [`dynamodb`](https://github.com/baseprime/dynamodb) models,
you use `dynastar` to expose them with
a [`datastar`](https://github.com/godaddy/datastar)-like API.

```js
const Dynastar = require('dynastar');
const Joi = require('joi');

function defineMyModel(dynamo) {

  const model = dynamo.define('mymodel', {
    hashKey: 'hashme',
    rangeKey: 'ranger',
    schema: {
      hashme: Joi.string(),
      ranger: dynamo.types.timeUUID()
    }
  });

  return new Dynastar({ model, hashKey: 'hashme', rangeKey: 'ranger' });
}

const mymodel = defineMyModel(require('dynamodb'));
```

### Key creation
Dynastar supports key builders for the hash and range keys. These are useful for combining
multiple values into one.

#### createHashKey
`createHashKey` can be used to build a compound hash key.

```js
const Dynastar = require('dynastar');
const Joi = require('joi');

function defineMyModel(dynamo) {
  const model = dynamo.define('mymodel', {
    hashKey: 'key',
    rangeKey: 'ranger',
    schema: {
      key: Joi.string(),
      ranger: Joi.string(),
      firstName: Joi.string(),
      lastName: Joi.string(),
      birthday: Joi.date()
    }
  });

  return new Dynastar({ 
    model, 
    hashKey: 'key', 
    rangeKey: 'ranger', 
    createHashKey: ({ firstName, lastName, birthday }) => `${firstName}!${lastName}!${birthday}`
  });
}
```

#### createRangeKey
`createRangeKey` can be used to build a compound range key.
```js
const Dynastar = require('dynastar');
const Joi = require('joi');

function defineMyModel(dynamo) {

  const model = dynamo.define('mymodel', {
    hashKey: 'hashme',
    rangeKey: 'ranger',
    schema: {
      hashme: Joi.string(),
      ranger: Joi.string(),
      time: Joi.date().iso(),
      uuid: dynamo.types.uuid()
    }
  });

  return new Dynastar({ 
    model, 
    hashKey: 'hashme', 
    rangeKey: 'ranger', 
    createRangeKey: ({ time, uuid }) => `${time}#${uuid}`
  });
}
```

## Migrations

### From 2 to 3

Version 3 of dynastar seeks to streamline the interface and add TypeScript support. Support for node versions under 16 is not guaranteed.

The constructor options have changed slightly. You now are required to pass a `hashKey` option, and the `createKey` option is now merged with the `createHashKey` option. Support for extension methods has also been removed.

```diff
const Thing = new Dynastar({
  model,
+  hashKey = 'key',
  rangeKey: 'category',
-  createKey: ({ id }) => `thing:id`,
+  createHashKey: ({ id }) => `thing:id`,
-  
-  findByIndex() {
-    // ...
-  },
-
-  findByCategory() {
-    // ...
-  }
})
```

Methods are all Promise-based, so there's no `AwaitWrap` function exposed any longer.

```diff
-model.findOne({ key: 'foo' }, (err, res) => {
-  // Handle error
-});
+try {
+  const res = await model.findOne({ key: 'foo' });
+} catch (err) {
+  // Handle error
+}
```

The `findAll` method now returns an async iterable rather than a Node stream.

```javascript
for await (const item of model.findAll({ key: foo })) {
  // ...
}
```

You can adapt it to a Stream if you want to use that interface:

```javascript
const { Readable } = require('node:stream');
const stream = Readable.from(model.findAll({ key: 'foo' }));
```

The `findAll` method also has a new boolean parameter if you prefer to receive an `Array` of items rather than an async iterable:

```javascript
const items = await model.findAll({ key: 'foo' }, true);
```

The `get` method alias has been removed; use the `findOne` method instead. Also `ensureTables` has been renamed to `ensureTable`, and `dropTables` has been renamed to `dropTable`.

## test

Run localstack locally in one terminal

```bash
npm run localstack
```

Run npm tests

```bash
npm test
```
