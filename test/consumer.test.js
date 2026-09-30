const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Run the shipped bundle without node_modules, as a downstream workflow does.
function run(t, { schema = { type: 'object', required: ['name'], properties: { name: { type: 'string' } }, additionalProperties: false }, files = { 'data.json': '{"name":"Ammar"}' }, inputs = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'action-ajv-consumer-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(path.resolve(__dirname, '../dist'), path.join(dir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schema));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  const output = path.join(dir, 'outputs');
  fs.writeFileSync(output, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('INPUT_') && key !== 'NODE_PATH'));
  Object.assign(env, { GITHUB_OUTPUT: output, INPUT_SCHEMA: 'schema.json', INPUT_DATA: 'data.json' });
  for (const [key, value] of Object.entries(inputs)) env[`INPUT_${key.toUpperCase()}`] = String(value);
  const proc = spawnSync(process.execPath, [path.join(dir, 'dist/index.js')], { cwd: dir, env, encoding: 'utf8', timeout: 15000 });
  assert.ifError(proc.error);
  const outputs = {};
  const text = fs.readFileSync(output, 'utf8');
  const pattern = /^(\w+)<<([^\r\n]+)\r?\n([\s\S]*?)\r?\n\2(?:\r?\n|$)/gm;
  for (const match of text.matchAll(pattern)) outputs[match[1]] = match[3];
  return { status: proc.status, outputs, log: proc.stdout + proc.stderr };
}

test('packaged action validates JSON and YAML without installed dependencies', t => {
  for (const [name, content] of [['data.json', '{"name":"Ammar"}'], ['data.yml', 'name: Ammar\n']]) {
    const r = run(t, { files: { [name]: content }, inputs: { data: name } });
    assert.equal(r.status, 0, r.log);
    assert.equal(r.outputs.valid, 'true');
  }
});

test('invalid data fails with structured errors', t => {
  for (const [name, content] of [['data.json', '{"name":42}'], ['data.yml', 'name: 42\n']]) {
    const r = run(t, { files: { [name]: content }, inputs: { data: name } });
    assert.equal(r.status, 1, r.log);
    assert.equal(r.outputs.valid, 'false');
    assert.ok(JSON.parse(r.outputs.errors).some(e => e.keyword === 'type'));
  }
});

test('glob failure retains errors even when the final file is valid', t => {
  const r = run(t, { files: { 'a.json': '{"name":42}', 'z.json': '{"name":"ok"}' }, inputs: { data: '[az].json' } });
  assert.equal(r.status, 1, r.log);
  assert.equal(r.outputs.valid, 'false');
  assert.ok(JSON.parse(r.outputs.errors).some(e => e.keyword === 'type'));
});

test('allErrors=false reports one error; true reports both', t => {
  const data = { schema: { type: 'object', required: ['a', 'b'] }, files: { 'data.json': '{}' } };
  const one = run(t, { ...data, inputs: { allErrors: false } });
  const all = run(t, { ...data, inputs: { allErrors: true } });
  assert.equal(JSON.parse(one.outputs.errors).length, 1);
  assert.equal(JSON.parse(all.outputs.errors).length, 2);
});

test('boolean options preserve false and apply coercion only when requested', t => {
  const data = { schema: { type: 'object', properties: { count: { type: 'integer' } } }, files: { 'data.json': '{"count":"2"}' } };
  assert.equal(run(t, { ...data, inputs: { coerceTypes: false } }).status, 1);
  assert.equal(run(t, { ...data, inputs: { coerceTypes: true } }).status, 0);
});

test('missing schema and malformed YAML fail and set valid=false', t => {
  for (const opts of [{ inputs: { schema: 'missing.json' } }, { files: { 'data.json': 'name: [unterminated' } }]) {
    const r = run(t, opts);
    assert.equal(r.status, 1, r.log);
    assert.equal(r.outputs.valid, 'false');
  }
});

test('empty data glob preserves documented legacy success behavior', t => {
  const r = run(t, { inputs: { data: 'missing-*.json' } });
  assert.equal(r.status, 0, r.log);
  assert.equal(r.outputs.valid, 'true');
});
