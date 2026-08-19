import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const isWin=process.platform==='win32';
const node=process.execPath;
function run(cmd,args){return spawnSync(cmd,args,{cwd:root,stdio:'inherit',shell:false});}
const tscBin=path.join(root,'node_modules','.bin',isWin?'tsc.cmd':'tsc');
if(existsSync(tscBin)){
  const tc=run(tscBin,['--noEmit','--pretty','false']);
  if(tc.status!==0)process.exit(tc.status??1);
}else console.warn('[안내] node_modules가 없어 별도 TypeScript typecheck는 생략합니다. 배포 전 npm run setup 후 npm run typecheck를 권장합니다.');
const viteBin=path.join(root,'node_modules','.bin',isWin?'vite.cmd':'vite');
function rollupNativeReady(){
  if(!existsSync(viteBin))return false;
  if(process.platform==='linux'&&process.arch==='x64')return existsSync(path.join(root,'node_modules','@rollup','rollup-linux-x64-gnu'))||existsSync(path.join(root,'node_modules','@rollup','rollup-linux-x64-musl'));
  if(process.platform==='win32'&&process.arch==='x64')return existsSync(path.join(root,'node_modules','@rollup','rollup-win32-x64-msvc'))||existsSync(path.join(root,'node_modules','@rollup','rollup-win32-x64-gnu'));
  if(process.platform==='darwin'&&process.arch==='arm64')return existsSync(path.join(root,'node_modules','@rollup','rollup-darwin-arm64'));
  if(process.platform==='darwin'&&process.arch==='x64')return existsSync(path.join(root,'node_modules','@rollup','rollup-darwin-x64'));
  return true;
}
if(rollupNativeReady()){
  const vite=run(viteBin,['build']);
  if(vite.status===0)process.exit(0);
  console.warn('[경고] Vite production build 실패. portable production build로 자동 전환합니다.');
}else if(existsSync(viteBin)){
  console.warn('[안내] 현재 압축본의 node_modules에 이 OS용 Rollup native binary가 없어 Vite build를 건너뜁니다. Railway/npm ci 환경에서는 OS용 패키지를 새로 설치하므로 정상 Vite build를 사용합니다.');
}
const fallback=run(node,['scripts/portable-build.mjs']);
process.exit(fallback.status??1);
