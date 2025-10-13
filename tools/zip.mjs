// tools/zip.mjs
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url); // bestzip is CJS
const bestzip = require('bestzip');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT = path.join(__dirname, '..', 'mortgage-master-toolkit.zip');

// remove previous zip if present
try { fs.unlinkSync(OUTPUT); } catch {}

await bestzip({
  source: 'mortgage-master-toolkit/**',      // include folder + contents
  destination: OUTPUT,                       // zip at repo root
  cwd: path.join(__dirname, '..', '_pack'),  // chdir so zip root is the folder above
});

console.log('✅ Created', OUTPUT);
