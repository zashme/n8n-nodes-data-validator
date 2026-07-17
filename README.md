# n8n-nodes-data-validator

This is an [n8n](https://n8n.io/) community node that validates input data against a [JSON Schema](https://json-schema.org/), powered by [Ajv](https://ajv.js.org/).

Use it to guard your workflows against malformed data — for example, validating incoming webhook payloads before passing them on to downstream services.

[Installation](#installation)
[Operations](#operations)
[Usage](#usage)
[Compatibility](#compatibility)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

For self-hosted n8n: **Settings → Community Nodes → Install**, then enter `n8n-nodes-data-validator`.

## Operations

The node validates every incoming item against the JSON Schema you provide and outputs one item per input item:

- **Valid item** → `{ "success": true, "data": <validated data> }`
- **Invalid item** → `{ "success": false, "validationErrors": [...], "data": <validated data> }`

Validation failures do **not** stop the workflow — route on the `success` flag (e.g. with an IF node) to decide how to handle invalid data. Binary data is passed through untouched.

If **Property to Validate** points to a property that does not exist on an item, the item is output as `success: false` with a single `validationErrors` entry whose `keyword` is `propertyPath` (and `data: null`), so a typo'd path is distinguishable from genuinely invalid data.

### Node parameters

| Parameter | Description |
|---|---|
| **JSON Schema** | The [JSON Schema](https://json-schema.org/) each item is validated against. |
| **Property to Validate** | Dot-notation path of the item property to validate, e.g. `body` for webhook payloads. Leave empty to validate the entire item JSON. |

### Supported schema features

- All standard JSON Schema keywords supported by [Ajv](https://ajv.js.org/json-schema.html) (draft-07 by default)
- Format validation via [ajv-formats](https://ajv.js.org/packages/ajv-formats.html): `email`, `uri`, `date-time`, `uuid`, `ipv4`, and more
- Custom error messages via [ajv-errors](https://ajv.js.org/packages/ajv-errors.html) using the `errorMessage` keyword
- Schemas are compiled in Ajv [strict mode](https://ajv.js.org/strict-mode.html): misspelled or unknown keywords are reported as errors instead of being silently ignored
- Both parameters support n8n expressions and may resolve to different values per item; identical schemas are compiled only once per execution
- Async schemas (`$async: true`) are not supported and are rejected with a clear error

## Usage

Example: validate a webhook payload. Set **Property to Validate** to `body` and use a schema like:

```json
{
	"type": "object",
	"properties": {
		"email": { "type": "string", "format": "email" },
		"age": { "type": "integer", "minimum": 0 }
	},
	"required": ["email"],
	"additionalProperties": false,
	"errorMessage": {
		"required": { "email": "The email field is required" }
	}
}
```

Then branch on `{{ $json.success }}` with an IF node: `true` continues the happy path, `false` goes to your error handling (reply with a 400, send an alert, etc.). The details of each failure are available in `{{ $json.validationErrors }}`.

## Compatibility

Requires n8n version 1.0 or above (Node.js >= 18.10).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Ajv documentation](https://ajv.js.org/)
- [JSON Schema documentation](https://json-schema.org/)

## Version history

- **1.1.0** — Validate all incoming items (previously only the first); new **Property to Validate** parameter (previously hardcoded to `body`); added `ajv-formats` (format validation) and enabled `ajv-errors` (custom error messages); strict-mode schema compilation; explicit error when the configured property path is missing; fixed the package so the node loads correctly when installed from npm.
- **1.0.x** — Initial release.

### Upgrading from 1.0.x

Version 1.0.x always validated `item.json.body`. Since 1.1.0 the node validates the **entire item JSON** by default. If your workflow validated webhook payloads, set **Property to Validate** to `body` to keep the old behavior.

## License

[MIT](LICENSE)
