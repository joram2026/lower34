import fs from 'fs';
import path from 'path';

const swPath = path.join(process.cwd(), 'dist', 'sw.js');

if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Replace the cache name with a unique build timestamp
  const uniqueId = Date.now();
  swContent = swContent.replace(
    /const CACHE_NAME = '[^']+'/,
    `const CACHE_NAME = 'arbitrage-${uniqueId}'`
  );
  
  // Add a unique build timestamp at the top of the file to guarantee byte-for-byte difference
  swContent = `// Build Timestamp: ${new Date().toISOString()}\n` + swContent;
  
  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log(`[PWA Build] Successfully injected unique cache identifier (arbitrage-${uniqueId}) into sw.js`);
} else {
  console.warn('[PWA Build] Warning: dist/sw.js not found!');
}
