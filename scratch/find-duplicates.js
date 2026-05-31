const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/dictionaries.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
let currentBlock = null;
const idKeys = new Map();
const enKeys = new Map();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNumber = i + 1;

  if (line.includes('id: {')) {
    currentBlock = 'id';
    continue;
  }
  if (line.includes('en: {')) {
    currentBlock = 'en';
    continue;
  }
  if (line.trim() === '}' && currentBlock) {
    // Check if it's the end of a block
    // lines are:
    //   },
    //   en: {
    // or
    //   }
    // };
  }

  // Look for keys like "some.key": or 'some.key':
  const match = line.match(/^\s*["']([^"']+)["']\s*:/);
  if (match) {
    const key = match[1];
    if (currentBlock === 'id') {
      if (idKeys.has(key)) {
        console.log(`Duplicate in ID: "${key}" at line ${lineNumber} (previously at line ${idKeys.get(key)})`);
      } else {
        idKeys.set(key, lineNumber);
      }
    } else if (currentBlock === 'en') {
      if (enKeys.has(key)) {
        console.log(`Duplicate in EN: "${key}" at line ${lineNumber} (previously at line ${enKeys.get(key)})`);
      } else {
        enKeys.set(key, lineNumber);
      }
    }
  }
}
