import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;
const args = new Set(process.argv.slice(2));
const noOpen = args.has('--no-open') || process.env.NO_OPEN === '1' || process.env.CI === 'true';
const forceSource = args.has('--source') || process.env.DEV_SOURCE === '1';
const requestedPort = Number(process.env.PORT || 5173);
const requestedApiPort = Number(process.env.API_PORT || 4000);
const viteBin = path.join(rootDir, 'node_modules', '.bin', isWindows ? 'vite.cmd' : 'vite');
const distIndex = path.join(rootDir, 'dist', 'index.html');
const children = new Set();
let shuttingDown = false;

function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.unref();
    tester.once('error', () => resolve(false));
    tester.listen({ port, host }, () => tester.close(() => resolve(true)));
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`${startPort}번대에서 사용할 수 있는 포트를 찾지 못했습니다.`);
}

function dependenciesReady() {
  if (!existsSync(viteBin)) return false;
  const result = spawnSync(npmCommand, ['ls', '--depth=0'], {
    cwd: rootDir,
    stdio: 'ignore',
    shell: false,
    timeout: 30_000,
  });
  return result.status === 0;
}

function openBrowser(url) {
  if (noOpen) return;
  try {
    if (isWindows) {
      const child = spawn('cmd', ['/c', 'start', '', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
      return;
    }
    if (process.platform === 'darwin') {
      const child = spawn('open', [url], { detached: true, stdio: 'ignore' });
      child.unref();
      return;
    }
    const child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (error) {
    console.warn(`[안내] 브라우저를 자동으로 열지 못했습니다. 직접 접속해주세요: ${url}`);
  }
}

function registerChild(child) {
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function stopChildren() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      if (isWindows) {
        spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      // 종료 중인 프로세스는 무시합니다.
    }
  }
}

process.once('SIGINT', () => {
  stopChildren();
  process.exit(0);
});
process.once('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});
process.once('exit', stopChildren);

async function startStaticMode() {
  if (!existsSync(distIndex)) {
    console.error('[오류] 개발 패키지와 dist/index.html이 모두 없습니다.');
    console.error('[해결] 인터넷 연결 후 npm run setup 및 npm run build를 실행하세요.');
    process.exit(1);
  }

  const port = await findAvailablePort(requestedPort);
  const url = `http://127.0.0.1:${port}/home`;
  console.log('[안내] 개발 패키지가 없어 현재 dist 빌드로 실행합니다.');
  console.log(`[안내] HOWTOM 유니버스: ${url}`);
  console.log('[안내] 이 모드에서도 화면과 내장 데모 API를 사용할 수 있습니다.');
  console.log('[안내] 소스 수정 실시간 반영이 필요하면 npm run setup 후 npm run dev:source를 실행하세요.');

  const child = registerChild(spawn(nodeCommand, ['server.mjs'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  }));

  child.once('error', (error) => {
    console.error(`[오류] 정적 서버 실행에 실패했습니다: ${error.message}`);
    process.exit(1);
  });

  setTimeout(() => openBrowser(url), 900);
}

async function installDependencies() {
  console.log('[안내] 소스 개발 모드에 필요한 패키지를 설치합니다.');
  const result = spawnSync(npmCommand, ['install'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });
  return result.status === 0 && dependenciesReady();
}

async function startSourceMode() {
  if (!dependenciesReady()) {
    if (!forceSource) return startStaticMode();
    const installed = await installDependencies();
    if (!installed) {
      console.warn('[경고] 패키지 설치에 실패해 기존 dist 빌드 실행을 시도합니다.');
      return startStaticMode();
    }
  }

  const port = await findAvailablePort(requestedPort);
  const apiPort = await findAvailablePort(requestedApiPort);
  const url = `http://127.0.0.1:${port}/home`;

  console.log(`[안내] API 서버를 시작합니다: http://127.0.0.1:${apiPort}`);
  const apiChild = registerChild(spawn(nodeCommand, ['server.mjs'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(apiPort) },
  }));

  apiChild.once('error', (error) => {
    console.error(`[오류] API 서버 실행에 실패했습니다: ${error.message}`);
  });

  console.log(`[안내] Vite 개발 서버를 시작합니다: ${url}`);
  const viteChild = registerChild(spawn(viteBin, [
    '--host', '127.0.0.1',
    '--port', String(port),
    '--strictPort',
  ], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, API_PORT: String(apiPort) },
  }));

  viteChild.once('error', async (error) => {
    console.error(`[경고] Vite 실행에 실패했습니다: ${error.message}`);
    try { apiChild.kill(); } catch { /* ignore */ }
    await startStaticMode();
  });

  viteChild.once('exit', async (code, signal) => {
    if (shuttingDown) return;
    if (code && code !== 0) {
      console.error(`[오류] Vite 개발 서버가 비정상 종료되었습니다. 종료 코드: ${code}, 신호: ${signal ?? '-'}`);
      console.warn('[안내] 기존 dist 빌드로 자동 전환을 시도합니다.');
      try { apiChild.kill(); } catch { /* ignore */ }
      await startStaticMode();
    }
  });

  setTimeout(() => openBrowser(url), 1200);
}

await startSourceMode();
