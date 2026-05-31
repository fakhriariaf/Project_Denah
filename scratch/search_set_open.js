const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        getFiles(filePath, files);
      }
    } else if (file.endsWith('.tsx')) {
      files.push(filePath);
    }
  });
  return files;
}

const allTsxFiles = getFiles('app');

allTsxFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('setOpen(false)')) {
    const lines = content.split('\n');
    console.log(`\n=================== ${file} ===================`);
    lines.forEach((line, idx) => {
      if (line.includes('setOpen(false)')) {
        // print 5 lines before and after
        const start = Math.max(0, idx - 4);
        const end = Math.min(lines.length - 1, idx + 4);
        for (let i = start; i <= end; i++) {
          console.log(`${i + 1}: ${lines[i].trim()}`);
        }
        console.log('---');
      }
    });
  }
});
