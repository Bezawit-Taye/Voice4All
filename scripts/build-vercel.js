const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const outputDirectory = path.join(repositoryRoot, 'dist');
const configuredApiUrl =
  process.env.VITE_API_URL || process.env.VOICE4ALL_API_BASE || '';

if (!configuredApiUrl.trim()) {
  throw new Error('Set VITE_API_URL to the deployed HTTPS Node backend URL.');
}

let apiUrl;
try {
  apiUrl = new URL(configuredApiUrl.trim());
} catch {
  throw new Error('VITE_API_URL must be a valid absolute HTTPS URL.');
}

if (
  apiUrl.protocol !== 'https:' ||
  !apiUrl.hostname ||
  apiUrl.hostname === 'localhost' ||
  apiUrl.hostname === '127.0.0.1' ||
  apiUrl.pathname !== '/' ||
  apiUrl.search ||
  apiUrl.hash
) {
  throw new Error('VITE_API_URL must be a public HTTPS backend origin without a path.');
}

const excludedDirectories = new Set([
  '.git',
  '.vercel',
  'backend',
  'docs',
  'node_modules',
]);

function copyFrontendTree(sourcePath, destinationPath) {
  fs.cpSync(sourcePath, destinationPath, {
    recursive: true,
    filter: (entryPath) => {
      const relativePath = path.relative(repositoryRoot, entryPath);
      return !relativePath
        .split(path.sep)
        .some(
          (segment) =>
            segment.startsWith('.') || excludedDirectories.has(segment),
        );
    },
  });
}

fs.mkdirSync(outputDirectory, { recursive: true });
fs.copyFileSync(
  path.join(repositoryRoot, 'index.html'),
  path.join(outputDirectory, 'index.html'),
);

for (const directory of ['assets', 'pages']) {
  const sourcePath = path.join(repositoryRoot, directory);
  if (fs.existsSync(sourcePath)) {
    copyFrontendTree(sourcePath, path.join(outputDirectory, directory));
  }
}

const configPath = path.join(
  outputDirectory,
  'assets',
  'js',
  'voice4all',
  'deployment-config.js',
);
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(
  configPath,
  `window.VOICE4ALL_API_BASE = ${JSON.stringify(apiUrl.origin)};\n`,
);

function injectRuntimeConfig(directoryPath) {
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      injectRuntimeConfig(entryPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) {
      continue;
    }

    const html = fs.readFileSync(entryPath, 'utf8');
    const headPattern = /<head\b[^>]*>/i;
    if (!headPattern.test(html)) {
      throw new Error(`Cannot inject API configuration into ${entryPath}: missing <head>.`);
    }

    const configuredHtml = html.replace(
      headPattern,
      (headTag) =>
        `${headTag}\n    <script src="/assets/js/voice4all/deployment-config.js"></script>`,
    );
    fs.writeFileSync(entryPath, configuredHtml);
  }
}

injectRuntimeConfig(outputDirectory);
console.log(`Built static frontend in ${outputDirectory} for ${apiUrl.origin}`);
