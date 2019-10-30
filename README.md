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

  function exampleFunction1(){
    // do something
  } 

  function exampleFunction2(){
    // do something
  } 

  return new Dynastar({ model, hashKey: 'hashme', rangeKey: 'ranger', exampleFunction1, exampleFunction2 });
}

const mymodel = defineMyModel(require('dynamodb'));
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
