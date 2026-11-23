import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
const blueprint = JSON.parse(
  fs.readFileSync(new URL('./firebase-blueprint.json', import.meta.url), 'utf8')
);

test('firestore.rules enforces global deny-all fallback and rules_version 2', () => {
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match\s*\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/);
});

test('firestore.rules covers every collection declared in firebase-blueprint.json', () => {
  const paths = Object.keys(blueprint.firestore);
  assert.ok(paths.length >= 5);
  assert.match(rules, /match\s+\/admins\/\{adminId\}/);
  assert.match(rules, /match\s+\/users\/\{userId\}/);
  assert.match(rules, /match\s+\/datasets\/\{datasetId\}/);
  assert.match(rules, /match\s+\/samples\/\{sampleId\}/);
  assert.match(rules, /match\s+\/notes\/\{noteId\}/);
});

test('firestore.rules enforces verified email, owner checks, strict keys, and request.time', () => {
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rules, /hasAll\(/);
  assert.match(rules, /hasOnly\(/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(/);
  assert.match(rules, /incoming\(\)\.createdAt\s*==\s*request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt\s*==\s*request\.time/);
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\/datasets\/\$\(incoming\(\)\.datasetKey\)\)/);
});

test('firestore.rules never uses blanket isSignedIn() list rules or JSON stringifying', () => {
  assert.equal(/allow\s+list:\s*if\s+isSignedIn\(\)\s*;/.test(rules), false);
  assert.equal(/allow\s+read:\s*if\s+isSignedIn\(\)\s*;/.test(rules), false);
});
