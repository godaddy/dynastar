# dynastar
[![Build Status](https://travis-ci.com/godaddy/dynastar.svg?branch=master)](https://travis-ci.com/godaddy/dynastar)

A simple compatibility layer for dynamodb models to be compatible with the datastar model API

## Install

```bash
npm install dynastar --save
```

## Usage

When defining your [`dynamodb`](https://github.com/baseprime/dynamodb) models,
you use `dynastar` to expose them with
a [`datastar`](https://github.com/godaddy/datastar) API. You can optionally pass
functions you would like to attach to the Dynastar class.

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
  //
  // A sync function must have a length of less than 2 if you want
  // to use the AwaitWrap wrapper
  //
  function exampleSyncFn(data) {
    // do something sync
    return someSyncResult;
  }

  function exampleAsyncFn(data, next) {
    // do something async
    next(null, someAsyncResult);
  }

  return new Dynastar({ model, hashKey: 'hashme', rangeKey: 'ranger', exampleSyncFn, exampleAsyncFn });
}

const mymodel = defineMyModel(require('dynamodb'));
```

### `AwaitWrap`

If you would like to enable an `await`able model, we have a class for that.

Building on the previous example...

```js
const { AwaitWrap } = require('dynastar');

const myAwaitModel = new AwaitWrap(mymodel);

// In this circumstance we have a sync function and async function that was
// added as "extra" onto the model itself. In this context the sync function
// is left untouched but the async callback function is made to be a `thenable`
// that can be awaited

const asyncResult = await myAwaitModel.exampleAsyncFn(data);
const syncResult = myAwaitModel.exampleSyncFn(data);

```

### Key creation
Dynastar supports key builders for the hash and range keys. These are useful for combining
multiple values into one.

#### createHashKey
`createHashKey` (or simply `createKey`) can be used to build a compound hash key.

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

## test

Run localstack locally in one terminal

```bash
npm run localstack
```

Run npm tests

```bash
npm test
```
