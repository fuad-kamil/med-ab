import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, arrayOfFiles);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      arrayOfFiles.push(filePath);
    }
  });
  return arrayOfFiles;
}

const clientSrc = path.resolve(__dirname, '..');
const files = getAllFiles(clientSrc);

const tRegex = /\bt\(\s*['"]([^'"]+)['"]/g;
const usedKeys = new Set();
const keyLocations = {};

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = tRegex.exec(content)) !== null) {
    const key = match[1];
    usedKeys.add(key);
    if (!keyLocations[key]) keyLocations[key] = [];
    keyLocations[key].push(path.relative(clientSrc, file));
  }
});

const en = JSON.parse(fs.readFileSync(path.join(clientSrc, 'locales/en.json'), 'utf8'));
const am = JSON.parse(fs.readFileSync(path.join(clientSrc, 'locales/am.json'), 'utf8'));

function hasKey(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }
  return current !== undefined;
}

const missingEn = [];
const missingAm = [];

Array.from(usedKeys).sort().forEach((key) => {
  if (!hasKey(en, key)) missingEn.push({ key, files: keyLocations[key] });
  if (!hasKey(am, key)) missingAm.push({ key, files: keyLocations[key] });
});

console.log('--- MISSING IN EN.JSON ---');
console.log(JSON.stringify(missingEn, null, 2));

console.log('--- MISSING IN AM.JSON ---');
console.log(JSON.stringify(missingAm, null, 2));
