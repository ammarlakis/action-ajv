const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

for (const entry of ['src/index.js', 'dist/index.js']) {
  test(`${entry}: action options and format validation`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'action-ajv-'));
    function run(schema, data, inputs = {}) {
      writeFileSync(join(directory, 'schema.json'), JSON.stringify(schema));
      writeFileSync(join(directory, 'data.json'), JSON.stringify(data));
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('INPUT_')));
      Object.assign(env, { INPUT_SCHEMA: join(directory, 'schema.json'), INPUT_DATA: join(directory, 'data.json') });
      for (const [key, value] of Object.entries(inputs)) env[`INPUT_${key.toUpperCase()}`] = String(value);
      const result = spawnSync(process.execPath, [resolve(entry)], { env, encoding: 'utf8', timeout: 30000 });
      assert.ifError(result.error);
      return result;
    }
    function expect(schema, data, inputs, success) {
      const result = run(schema, data, inputs);
      assert.equal(result.status, success ? 0 : 1, result.stdout + result.stderr);
      if (success) assert.match(result.stdout, /::set-output name=valid::true/);
      return result.stdout;
    }
    try {
      const unknown = { type: 'object', properties: { App_RapidStartup: { type: 'boolean', format: 'boolean' } } };
      const disabled = { strict: false, validateFormats: false, allErrors: true, verbose: true };
      expect(unknown, { App_RapidStartup: true }, disabled, true);
      expect(unknown, { App_RapidStartup: 'wrong' }, disabled, false);
      expect(unknown, { App_RapidStartup: true }, {}, false);
      expect(unknown, { App_RapidStartup: true }, { strict: true }, false);
      expect({ properties: { value: { type: 'integer' } } }, { value: 1 }, { strict: 'log' }, true);
      const custom = { type: 'string', format: 'boolean' };
      const formats = JSON.stringify({ boolean: { pattern: '^(yes|no)$', flags: 'i' } });
      expect(custom, 'YES', { formats }, true);
      expect(custom, 'yesterday', { formats }, false);
      expect(custom, 'wrong', { formats, validateFormats: false }, true);
      expect({ type: 'array', items: custom }, ['yes', 'yes', 'NO', 'yes'], { formats }, true);
      expect(custom, 'yes', { formats: '{}' }, false);
      expect(custom, 'yes', { formats: '' }, false);
      for (const malformed of ['{', 'null', '[]', 'true',
        '{"boolean":"/yes/i"}', '{"boolean":null}', '{"boolean":{}}',
        '{"boolean":{"pattern":1}}', '{"boolean":{"pattern":"yes","flags":1}}',
        '{"boolean":{"pattern":"yes","extra":true}}',
        '{"boolean":{"pattern":"["}}',
        ...['g', 'y', 'ig', 'ii', 'z'].map(flags => JSON.stringify({ boolean: { pattern: 'yes', flags } }))]) {
        assert.match(expect(custom, 'yes', { formats: malformed }, false), /Invalid formats input/);
      }
      expect(custom, 'yes', { formats: JSON.stringify({ boolean: { pattern: '^yes$' } }) }, true);
      expect({ type: 'string', format: 'digits' }, '123', {
        formats: JSON.stringify({ digits: { pattern: '^\\d+$' } })
      }, true);
      const override = { formats: JSON.stringify({ email: { pattern: '^local$' } }) };
      expect({ type: 'string', format: 'email' }, 'local', override, true);
      expect({ type: 'string', format: 'email' }, 'a@example.com', override, false);
      const email = { type: 'string', format: 'email' };
      expect(email, 'not-email', {}, false);
      expect(email, 'not-email', { validateFormats: true }, false);
      expect(email, 'not-email', { validateFormats: false }, true);
      expect(email, 'a@example.com', {}, true);
      expect({ type: 'array', items: { type: 'integer' } }, ['1'], { coerceTypes: true, inlineRefs: 0, loopRequired: 2, loopEnum: 2 }, true);
      expect({ type: 'integer' }, ['1'], { coerceTypes: 'array' }, true);
      expect({ type: 'integer' }, '1', { coerceTypes: false }, false);
      expect({ type: 'object', properties: { value: { type: 'integer', default: 1 } }, required: ['value'] }, {}, { useDefaults: true }, true);
      expect({ type: 'object', properties: { value: { type: 'integer', default: 1 } }, required: ['value'] }, {}, {}, false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
