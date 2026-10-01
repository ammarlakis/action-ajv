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
