import { createServer, request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const outDir = path.join(rootDir, '.portable');
const outSrcDir = path.join(outDir, 'src');
const publicDir = path.join(rootDir, 'public');
const port = Number(process.env.PORT || 5173);
const apiPort = Number(process.env.API_PORT || 4000);
const require = createRequire(import.meta.url);
const tsCandidates = [path.join(rootDir, 'vendor', 'typescript', 'typescript.js'), path.join(rootDir, 'vendor', 'typescript', 'lib', 'typescript.js'), path.join(rootDir, 'node_modules', 'typescript', 'lib', 'typescript.js')];
const tsPath = tsCandidates.find(existsSync);

if (!tsPath) {
  console.error('[오류] 휴대용 실행에 필요한 TypeScript 런타임을 찾지 못했습니다.');
  process.exit(1);
}

const ts = require(tsPath);

const importMap = {
  imports: {
    react: 'https://esm.sh/react@18.3.1',
    'react/': 'https://esm.sh/react@18.3.1/',
    'react-dom': 'https://esm.sh/react-dom@18.3.1?external=react',
    'react-dom/': 'https://esm.sh/react-dom@18.3.1/',
    'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client?external=react',
    'react-router-dom': 'https://esm.sh/react-router-dom@6.26.2?external=react,react-dom',
    'lucide-react': 'https://esm.sh/lucide-react@0.383.0?external=react',
    dompurify: 'https://esm.sh/dompurify@3.4.13',
    html2canvas: 'https://esm.sh/html2canvas@1.4.1',
    jspdf: 'https://esm.sh/jspdf@4.2.1',
    'jspdf-autotable': 'https://esm.sh/jspdf-autotable@5.0.8?external=jspdf',
    jszip: 'https://esm.sh/jszip@3.10.1',
    xlsx: 'https://esm.sh/xlsx@0.18.5',
  },
};

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function transpileSources() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outSrcDir, { recursive: true });
  let count = 0;
  for (const input of walk(srcDir)) {
    const rel = path.relative(srcDir, input);
    const ext = path.extname(input).toLowerCase();
    const targetBase = path.join(outSrcDir, rel);
    mkdirSync(path.dirname(targetBase), { recursive: true });

    if ((ext === '.ts' || ext === '.tsx') && !input.endsWith('.d.ts')) {
      const source = readFileSync(input, 'utf8');
      const result = ts.transpileModule(source, {
        fileName: input,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          jsx: ts.JsxEmit.ReactJSX,
          useDefineForClassFields: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          isolatedModules: true,
          sourceMap: false,
        },
        reportDiagnostics: true,
      });
      const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
      if (errors.length) {
        const first = errors[0];
        const message = ts.flattenDiagnosticMessageText(first.messageText, '\n');
        throw new Error(`${rel}: ${message}`);
      }
      let output = result.outputText;
      // 브라우저 native ESM은 CSS import를 실행할 수 없으므로 HTML에서 stylesheet로 로드합니다.
      output = output.replace(/^\s*import\s+['"][^'"]+\.css['"]\s*;?\s*$/gm, '');
      writeFileSync(targetBase.replace(/\.tsx?$/i, '.js'), output, 'utf8');
      count += 1;
    } else if (ext === '.css') {
      writeFileSync(targetBase, readFileSync(input));
    }
  }
  return count;
}

function html() {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>HOWTOM 유니버스</title>
  <link rel="stylesheet" href="/src/index.css" />
  <link rel="stylesheet" href="/src/control/control.css" />
  <script type="importmap">${JSON.stringify(importMap)}</script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`;
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
  })[ext] || 'application/octet-stream';
}

function safePath(base, requestPath) {
  const resolved = path.resolve(base, `.${requestPath}`);
  if (!resolved.startsWith(path.resolve(base))) return null;
  return resolved;
}

function resolvePortableFile(urlPath) {
  if (urlPath.startsWith('/src/')) {
    const relative = urlPath.slice('/src'.length);
    const base = safePath(outSrcDir, relative);
    if (!base) return null;
    const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
    return candidates.find((f) => existsSync(f) && statSync(f).isFile()) || null;
  }
  const publicFile = safePath(publicDir, urlPath);
  if (publicFile && existsSync(publicFile) && statSync(publicFile).isFile()) return publicFile;
  return null;
}

function proxyApi(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${apiPort}` };
  const proxy = httpRequest({
    hostname: '127.0.0.1',
    port: apiPort,
    path: req.url,
    method: req.method,
    headers,
  }, (upstream) => {
    res.writeHead(upstream.statusCode || 502, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `API 서버 연결 실패: ${error.message}` }));
  });
  req.pipe(proxy);
}

let count = 0;
try {
  count = transpileSources();
} catch (error) {
  console.error(`[오류] 휴대용 소스 변환에 실패했습니다: ${error.message}`);
  process.exit(1);
}

const appHtml = html();
const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) return proxyApi(req, res);

  const file = resolvePortableFile(decodeURIComponent(url.pathname));
  if (file) {
    res.writeHead(200, {
      'content-type': mime(file),
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(readFileSync(file));
    return;
  }

  // React Router SPA 경로는 모두 앱 HTML로 반환합니다.
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(appHtml);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[완료] 휴대용 소스 변환: ${count}개 TS/TSX`);
  console.log(`[안내] Portable Mode: http://127.0.0.1:${port}/home`);
  console.log('[안내] npm 패키지 설치 없이 현재 소스를 실행합니다.');
  console.log('[안내] 브라우저에서 외부 라이브러리 CDN(esm.sh)에 접근할 수 있어야 합니다.');
});
