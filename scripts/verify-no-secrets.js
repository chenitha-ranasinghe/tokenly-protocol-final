#!/usr/bin/env node
/**
 * Fail CI if obvious secret patterns appear in tracked source (excluding this script).
 */
const fs = require('fs');
const path = require('path');

const BAD = [
  /sk_live_[0-9a-zA-Z]+/,
  /AIza[0-9A-Za-z\-_]{20,}/,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /GROQ_API_KEY\s*=\s*['"]?gsk_[a-zA-Z0-9]+/,
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (['node_modules', '.next', '.git', 'TOKENLY_BACKUP'].some((x) => name.name.includes(x))) continue;
      walk(p, out);
    } else if (/\.(ts|tsx|js|mjs|json|env)$/.test(name.name) && !name.name.endsWith('package-lock.json')) {
      out.push(p);
    }
  }
  return out;
}

const root = path.join(__dirname, '..');
let failed = false;
for (const file of walk(path.join(root, 'src')).concat(walk(path.join(root, 'scripts')))) {
  const txt = fs.readFileSync(file, 'utf8');
  for (const re of BAD) {
    if (re.test(txt)) {
      console.error(`[verify-no-secrets] Pattern ${re} in ${path.relative(root, file)}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('[verify-no-secrets] OK');
