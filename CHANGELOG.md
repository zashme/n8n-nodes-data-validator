# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0]

### Added

- **Property to Validate** parameter — validate any dot-notation path on the
  item (e.g. `body` for webhook payloads) instead of a hardcoded property.
- Format validation via `ajv-formats` (`email`, `uri`, `date-time`, `uuid`,
  `ipv4`, and more).
- Custom error messages via `ajv-errors` using the `errorMessage` keyword.
- Explicit, distinguishable error (`validationErrors[].keyword === "propertyPath"`)
  when the configured property path is missing from an item.
- `usableAsTool` support so the node can be used by the AI agent.

### Changed

- All incoming items are now validated (previously only the first item was).
- Schemas are compiled in Ajv strict mode; misspelled or unknown keywords are
  reported as errors instead of being silently ignored. Identical schemas are
  compiled only once per execution.
- Ajv and its plugins are now bundled into the published node, so the package
  ships with no runtime dependencies and installs cleanly on self-hosted n8n.

### Fixed

- Package metadata and build output so the node loads correctly when installed
  from npm.

## [1.0.0]

### Added

- Initial release: validate `item.json.body` against a JSON Schema using Ajv.

[1.1.0]: https://github.com/zashme/n8n-nodes-data-validator/releases/tag/1.1.0
[1.0.0]: https://github.com/zashme/n8n-nodes-data-validator/releases/tag/1.0.0
