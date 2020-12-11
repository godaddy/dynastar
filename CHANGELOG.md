# CHANGELOG

- [#8] Bump to `dynamodb-x@2.0.0`
- Updated `devDependencies`

### 1.3.1

- [#9] Add support for newer localstack's where createTable no longer ignores already existing tables
- [#10] Switch to github actions

### 1.3.0

- [#7] Add `createRangeKey` for generating the range key from multiple keys

### 1.2.0

- [#4] Allow for additional options to get passed in where not already available (`get`, `create`, `update`, `remove`).
- [#3] Make sure we can catch exceptions from `findAll`
- Make sure callers can easily call a `findAll` variant with indexes
- Dropped `node@8` support

### 1.1.1

- [#2] Remove Global Table attributes (`aws:rep:deleting`, `aws:rep:updatetime`, `aws:rep:updateregion`) when creating or updating records.

### 1.1.0

- [#1] Add awaitWrap which hoists functions passed to Dynastar.

### 1.0.0

- Initial Version

[#1]: https://github.com/godaddy/dynastar/pull/1
[#2]: https://github.com/godaddy/dynastar/pull/2
[#3]: https://github.com/godaddy/dynastar/pull/3
[#4]: https://github.com/godaddy/dynastar/pull/4
[#7]: https://github.com/godaddy/dynastar/pull/7
[#8]: https://github.com/godaddy/dynastar/pull/8
[#9]: https://github.com/godaddy/dynastar/pull/9
[#10]: https://github.com/godaddy/dynastar/pull/10
