import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '../..');

let errors = [];

function checkFile(filePath, content) {
  const relPath = path.relative(clientRoot, filePath);
  if (relPath.includes('check-typography.js')) return;

  // Check index.html for Google Fonts CDN links
  if (relPath === 'index.html') {
    if (content.includes('fonts.googleapis.com') || content.includes('fonts.gstatic.com')) {
      errors.push(`[${relPath}] External Google Fonts CDN links found! Remove CDN links.`);
    }
  }

  // Check for hard-coded font sizes below 12px (text-[10px], text-[11px], text-[9px], etc.) except SVG dimensions or icon sizes
  const fontSmallMatch = content.match(/text-\[(?:[0-9]|10|11)px\]/g);
  if (fontSmallMatch && !relPath.includes('node_modules')) {
    errors.push(`[${relPath}] Hard-coded text size below 12px found: ${fontSmallMatch.join(', ')}`);
  }

  // Check for uppercase or tracking class in JSX where not allowed
  if (relPath.endsWith('.jsx') || relPath.endsWith('.js')) {
    if (content.includes('uppercase') && !relPath.includes('check-') && !relPath.includes('TypographySpecimen')) {
      // Allow helper methods like .toUpperCase() for initials
      const uppercaseClassMatch = content.match(/className=["'][^"']*\buppercase\b[^"']*["']/g);
      if (uppercaseClassMatch) {
        errors.push(`[${relPath}] className contains uppercase utility: ${uppercaseClassMatch.join(', ')}`);
      }
    }
  }
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        scanDir(fullPath);
      }
    } else if (entry.isFile() && /\.(html|js|jsx|css)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      checkFile(fullPath, content);
    }
  }
}

console.log('🔍 Auditing Typography System...');
scanDir(clientRoot);

if (errors.length > 0) {
  console.error('\n❌ Typography Audit Failures:');
  errors.forEach((err) => console.error(`  - ${err}`));
  process.exit(1);
} else {
  console.log('✅ Typography Audit Passed! All font rules, self-hosted assets, and scale tokens are compliant.\n');
}
