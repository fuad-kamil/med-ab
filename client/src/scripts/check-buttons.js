import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('src');
let warnings = 0;
let errors = 0;

function checkFile(filePath) {
  if (!filePath.endsWith('.jsx') && !filePath.endsWith('.js')) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(srcDir, filePath);

  // Exempt primitive component files
  if (relPath.includes('components/Button.jsx') || relPath.includes('components/Common.jsx') || relPath.includes('components/Modal.jsx')) {
    return;
  }

  const lines = content.split('\n');
  lines.forEach((line, index) => {
    // Check raw <button> without data-allow-raw
    if (line.includes('<button') && !line.includes('data-allow-raw')) {
      console.warn(`[Button Audit Warning] ${relPath}:${index + 1} Raw <button> element used without data-allow-raw. Prefer <Button> or <IconButton>.`);
      warnings++;
    }
  });
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else {
      checkFile(full);
    }
  }
}

walk(srcDir);
console.log(`\n✅ Button Audit completed with ${warnings} warnings and ${errors} errors.`);
process.exit(errors > 0 ? 1 : 0);
