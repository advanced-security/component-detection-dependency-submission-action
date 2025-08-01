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

// Replace any remaining import statements
content = content.replace(
  /^import\s+(.*?)\s*;/gm,
  'require($1);'
);

// Write the converted content
fs.writeFileSync(outputFile, content, 'utf8');

console.log(`Converted ES module to CommonJS: ${outputFile}`);
