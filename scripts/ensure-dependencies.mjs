import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// vite 폴더 존재 여부만 보면, node_modules가 있어도 다른 패키지가 빠져 있거나 버전이 안 맞는
// "불완전 설치" 상태를 놓칠 수 있습니다. npm ls --depth=0으로 package.json에 선언된 최상위
// 의존성이 실제로 전부 정상 설치돼 있는지 확인하고, 문제가 있으면 npm install을 다시 돌립니다.
function checkDependenciesOk() {
  if (!existsSync('node_modules')) return false;
  const result = spawnSync(npmCommand, ['ls', '--depth=0'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    shell: false,
  });
  // npm ls는 누락되거나 버전이 안 맞는 패키지가 있으면 0이 아닌 종료 코드를 반환합니다.
  return result.status === 0;
}

if (checkDependenciesOk()) {
  process.exit(0);
}

console.log('[안내] 설치된 패키지 상태가 불완전해 npm install을 다시 실행합니다.');
const installResult = spawnSync(npmCommand, ['install'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: false,
});

if (installResult.error) {
  console.error('[오류] npm install 실행에 실패했습니다:', installResult.error.message);
  process.exit(1);
}

if (installResult.status !== 0) {
  console.error('[오류] 패키지 설치에 실패했습니다. 위 오류 내용을 확인해주세요.');
  process.exit(installResult.status ?? 1);
}

if (!checkDependenciesOk()) {
  console.error('[오류] 설치가 끝났지만 여전히 패키지 상태가 불완전합니다. node_modules를 삭제한 뒤 다시 실행해주세요.');
  process.exit(1);
}

console.log('[완료] 패키지 설치가 끝났습니다. 개발 서버를 시작합니다.');
