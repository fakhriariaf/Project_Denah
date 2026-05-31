const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/dictionaries.ts');
let content = fs.readFileSync(filePath, 'utf8');

const idKeys = {
  "nav.settings.users": "Manajemen Pengguna",
  "nav.settings.audit": "Audit Log"
};

const enKeys = {
  "nav.settings.users": "User Management",
  "nav.settings.audit": "Audit Log"
};

const lines = content.replace(/\r\n/g, '\n').split('\n');

let idEndIndex = -1;
let enEndIndex = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('  },') && idEndIndex === -1) {
    idEndIndex = i; // Line with the closing brace of id
  } else if (line.trim() === '}' && idEndIndex !== -1 && enEndIndex === -1) {
    enEndIndex = i; // Line with the closing brace of en
  }
}

console.log(`idEndIndex: ${idEndIndex}, enEndIndex: ${enEndIndex}`);

const idLinesToAdd = Object.entries(idKeys).map(([k, v]) => `    "${k}": "${v.replace(/"/g, '\\"')}",`);
const enLinesToAdd = Object.entries(enKeys).map(([k, v]) => `    "${k}": "${v.replace(/"/g, '\\"')}",`);

lines.splice(idEndIndex, 0, ...idLinesToAdd);
enEndIndex += idLinesToAdd.length;
lines.splice(enEndIndex, 0, ...enLinesToAdd);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Successfully added missing nav keys to dictionaries.ts!');
