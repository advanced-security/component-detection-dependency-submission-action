/**
 * ES Module to CommonJS Converter for Azure DevOps Extension
 * 
 * This script is necessary because:
 * 1. ncc (Node.js Compiler Collection) always outputs ES modules with import/export syntax
 * 2. Azure DevOps task runtime expects CommonJS modules with require() syntax
 * 3. Even with "type": "commonjs" in package.json, the bundled code contains ES module syntax
 * 4. Azure DevOps cannot execute ES modules, resulting in "Cannot use import statement outside a module" errors
 * 
 * The script converts:
 * - import statements → require() calls
 * - import.meta.url → __filename (CommonJS equivalent)
 * - ES module destructuring → CommonJS destructuring
 * 
 * This allows the same TypeScript codebase to work in both GitHub Actions (ES modules) 
 * and Azure DevOps (CommonJS) environments.
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'ado-dist', 'index.js');
const outputFile = path.join(__dirname, '..', 'component-detection-github-submission-task', 'index.js');

// Read the ES module output from ncc
let content = fs.readFileSync(inputFile, 'utf8');

// Convert ES module imports/exports to CommonJS
// Replace import statements at the beginning
content = content.replace(
  /^import\s+(['"].*?['"])\s*;/gm,
  'require($1);'
);

// Replace import with destructuring
content = content.replace(
  /^import\s*{\s*([^}]+)\s*}\s*from\s*(['"].*?['"])\s*;/gm,
  'const { $1 } = require($2);'
);

// Replace default imports
content = content.replace(
  /^import\s+(\w+)\s+from\s*(['"].*?['"])\s*;/gm,
  'const $1 = require($2);'
);

// Replace createRequire import (this is specific to the ncc output)
content = content.replace(
  /import\s*{\s*createRequire\s+as\s+__WEBPACK_EXTERNAL_createRequire\s*}\s*from\s*['"]module['"];/g,
  'const { createRequire: __WEBPACK_EXTERNAL_createRequire } = require("module");'
);

// Replace createRequire usage with import.meta.url to use __filename
content = content.replace(
  /__WEBPACK_EXTERNAL_createRequire\(import\.meta\.url\)/g,
  '__WEBPACK_EXTERNAL_createRequire(__filename)'
);

// Replace any remaining import.meta.url with __filename (CommonJS equivalent)
content = content.replace(
  /import\.meta\.url/g,
  '__filename'
);

// Replace any remaining import statements
content = content.replace(
  /^import\s+(.*?)\s*;/gm,
  'require($1);'
);

// Write the converted content
fs.writeFileSync(outputFile, content, 'utf8');

console.log(`Converted ES module to CommonJS: ${outputFile}`);
