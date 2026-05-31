const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/dictionaries.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to \n
const lines = content.replace(/\r\n/g, '\n').split('\n');

let idStart = -1;
let idEnd = -1;
let enStart = -1;
let enEnd = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('id: {')) {
    idStart = i + 1; // first line of id keys
  } else if (line.includes('  },') && idStart !== -1 && idEnd === -1) {
    idEnd = i - 1; // last line of id keys
  } else if (line.includes('  en: {')) {
    enStart = i + 1; // first line of en keys
  } else if (line.trim() === '}' && enStart !== -1 && enEnd === -1) {
    enEnd = i - 1; // last line of en keys
  }
}

console.log(`ID range: ${idStart + 1} to ${idEnd + 1}`);
console.log(`EN range: ${enStart + 1} to ${enEnd + 1}`);

function deduplicateBlock(blockLines, blockName) {
  const keyMap = new Map(); // key -> Array of { index, key, line, rest }
  
  for (let i = 0; i < blockLines.length; i++) {
    const line = blockLines[i];
    const cleanLine = line.trim();
    const colonIndex = cleanLine.indexOf(':');
    if (colonIndex > 0) {
      const left = cleanLine.substring(0, colonIndex).trim();
      const right = cleanLine.substring(colonIndex + 1).trim();
      const keyMatch = left.match(/^["']([^"']+)["']$/);
      if (keyMatch) {
        const key = keyMatch[1];
        if (!keyMap.has(key)) {
          keyMap.set(key, []);
        }
        keyMap.get(key).push({ index: i, key, line, rest: right });
      }
    }
  }

  const linesToDelete = new Set();
  
  for (const [key, occurrences] of keyMap.entries()) {
    if (occurrences.length > 1) {
      console.log(`[${blockName}] Key "${key}" has ${occurrences.length} occurrences.`);
      const first = occurrences[0];
      const last = occurrences[occurrences.length - 1];
      
      // Update the first occurrence with the last occurrence's value/rest of the line
      const indent = first.line.match(/^\s*/)[0];
      blockLines[first.index] = `${indent}"${key}": ${last.rest}`;
      
      // Delete all occurrences after the first one
      for (let j = 1; j < occurrences.length; j++) {
        linesToDelete.add(occurrences[j].index);
      }
    }
  }

  // Filter out lines marked for deletion
  const newBlockLines = blockLines.filter((_, idx) => !linesToDelete.has(idx));
  return newBlockLines;
}

const idLines = lines.slice(idStart, idEnd + 1);
const enLines = lines.slice(enStart, enEnd + 1);

console.log('--- Deduplicating ID block ---');
const newIdLines = deduplicateBlock(idLines, 'ID');

console.log('--- Deduplicating EN block ---');
const newEnLines = deduplicateBlock(enLines, 'EN');

const part0 = lines.slice(0, idStart);
const part2 = lines.slice(idEnd + 1, enStart);
const part4 = lines.slice(enEnd + 1);

const newContent = [
  ...part0,
  ...newIdLines,
  ...part2,
  ...newEnLines,
  ...part4
].join('\n');

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully wrote deduplicated file!');
