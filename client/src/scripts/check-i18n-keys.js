import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrc = path.resolve(__dirname, '..');

const enPath = path.join(clientSrc, 'locales/en.json');
const amPath = path.join(clientSrc, 'locales/am.json');
const arPath = path.join(clientSrc, 'locales/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const am = JSON.parse(fs.readFileSync(amPath, 'utf-8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf-8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = getKeys(en);
const amKeys = getKeys(am);
const arKeys = getKeys(ar);

const missingInAm = enKeys.filter((k) => !amKeys.includes(k));
const missingInAr = enKeys.filter((k) => !arKeys.includes(k) && !k.endsWith('_zero') && !k.endsWith('_one') && !k.endsWith('_two') && !k.endsWith('_few') && !k.endsWith('_many') && !k.endsWith('_other'));

console.log('=== i18n Key Audit (EN / AM / AR) ===');
console.log(`Total English keys: ${enKeys.length}`);
console.log(`Total Amharic keys: ${amKeys.length}`);
console.log(`Total Arabic keys:  ${arKeys.length}`);

let hasErrors = false;

if (missingInAm.length > 0) {
  console.error('\n❌ Keys missing in am.json:');
  missingInAm.forEach((k) => console.error(`  - ${k}`));
  hasErrors = true;
}

if (missingInAr.length > 0) {
  console.error('\n❌ Base keys missing in ar.json:');
  missingInAr.forEach((k) => console.error(`  - ${k}`));
  hasErrors = true;
}

// 2. Scan JSX / JS code files for t('key') calls
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('dist')) {
        getAllFiles(filePath, arrayOfFiles);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      arrayOfFiles.push(filePath);
    }
  });
  return arrayOfFiles;
}

const codeFiles = getAllFiles(clientSrc);
const tRegex = /\bt\(\s*['"]([^'"]+)['"]/g;
const rawKeyPattern = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/;
const missingCodeKeys = [];

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

codeFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = tRegex.exec(content)) !== null) {
    const key = match[1];
    if (rawKeyPattern.test(key)) {
      if (!hasKey(en, key)) {
        missingCodeKeys.push({ key, file: path.relative(clientSrc, file), lang: 'en' });
      }
      if (!hasKey(am, key)) {
        missingCodeKeys.push({ key, file: path.relative(clientSrc, file), lang: 'am' });
      }
      if (!hasKey(ar, key)) {
        missingCodeKeys.push({ key, file: path.relative(clientSrc, file), lang: 'ar' });
      }
    }
  }
});

if (missingCodeKeys.length > 0) {
  console.error('\n❌ Raw translation keys found in code missing from locales:');
  missingCodeKeys.forEach((item) => {
    console.error(`  - "${item.key}" in ${item.file} (missing in ${item.lang}.json)`);
  });
  hasErrors = true;
}

if (!hasErrors) {
  console.log('\n✅ All translation keys are perfectly configured and in sync across EN, AM, and AR!');
} else {
  process.exit(1);
}
