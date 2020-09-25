# CHANGELOG

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
