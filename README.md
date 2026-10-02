# Ajv JSON Schema Validator Action

This GitHub action can be used to validate json and yaml files against a [JSON Schema](https://json-schema.org/).

## Inputs

### `schema`
The schema file used for valiation.

### `data`
The data files to be validated. Glob pattern is supported.

### `formats`
Custom string formats are supplied as a JSON object in a YAML block scalar.
GitHub Actions inputs must be scalars; nested YAML mappings under `with` are invalid.
Each format definition contains a `pattern` string and optional `flags` string:

```yaml
with:
  schema: schemas/manifest.schema.json
  data: manifest.json
  formats: |
    {"boolean": {"pattern": "^(true|false|0|1|yes|no|enabled|disabled|on|off)$", "flags": "i"}}
```

Use `{"type": "string", "format": "boolean"}` in the schema for this example.
Patterns are regex source, not `/pattern/flags` literals. JSON escaping applies
(e.g. `"\\d+"` for a digit pattern). Anchor patterns with `^` and `$` for
whole-value matching. Flags are checked by the Node.js regex engine; `g` and `y`
are rejected because they make repeated validation stateful. Malformed JSON,
definitions, patterns, or flags fail the action. No executable code is accepted.
Custom formats are registered after built-ins and override matching names.
`validateFormats: false` disables custom checks too. Native boolean values should
use `type: boolean`; for a fixed vocabulary, a schema `enum` may be simpler.

### Additional options
This action supports most of [Ajv options](https://ajv.js.org/options.html).

## Outputs

### `valid`
The result of the validation.

### `errors`
The errors in case the validation failed.

## Example usage

```yaml
name: Validation

on:
  push:
    branches:
      - master

jobs:
  validate-config:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: validate
      uses: ammarlakis/action-ajv@master
      with:
        schema: schemas/account.schema.json
        data: accounts/*.yml
        allErrors: true
```

Boolean options accept `true` and `false`; omitted options retain Ajv's defaults.
String modes (such as `strict: log` or `coerceTypes: array`) and numeric options
are also supported. `validateFormats: false` disables format checks, not type
validation. For boolean fields use `type: boolean`, rather than `format: boolean`.

## Development

Install dependencies with `npm ci`, run regression tests with `npm test`, and
rebuild the committed action entry point with `npm run build` before submitting
changes. Tests exercise both `src/index.js` and `dist/index.js`.
