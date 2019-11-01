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
  // A sync function must have a length of less than 2 if you are to be able
  // to use the AwaitWrap wrapper
  //
  function exampleSyncFn() {
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
// is left untouch but the async callback functon is made to be a `thenable`
// that can be awaited

const asyncResult = await myAwaitModel.exampleAsyncFn(data);
const syncResult = myAwaitModel.exampleSyncFn(data);

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
