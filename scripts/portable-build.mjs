import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const rootDir=path.resolve(__dirname,'..');
const srcDir=path.join(rootDir,'src');
const distDir=path.join(rootDir,'dist');
const outSrcDir=path.join(distDir,'src');
const publicDir=path.join(rootDir,'public');
const require=createRequire(import.meta.url);
const candidates=[
  path.join(rootDir,'vendor','typescript','typescript.js'),
  path.join(rootDir,'vendor','typescript','lib','typescript.js'),
  path.join(rootDir,'node_modules','typescript','lib','typescript.js'),
];
const tsPath=candidates.find(existsSync);
if(!tsPath) throw new Error('TypeScript runtime을 찾지 못했습니다. npm run setup 또는 vendor/typescript를 확인하세요.');
const ts=require(tsPath);

const importMap={imports:{
  react:'https://esm.sh/react@18.3.1',
  'react/':'https://esm.sh/react@18.3.1/',
  'react-dom':'https://esm.sh/react-dom@18.3.1?external=react',
  'react-dom/':'https://esm.sh/react-dom@18.3.1/',
  'react-dom/client':'https://esm.sh/react-dom@18.3.1/client?external=react',
  'react-router-dom':'https://esm.sh/react-router-dom@6.26.2?external=react,react-dom',
  'lucide-react':'https://esm.sh/lucide-react@0.383.0?external=react',
  dompurify:'https://esm.sh/dompurify@3.4.13',
  html2canvas:'https://esm.sh/html2canvas@1.4.1',
  jspdf:'https://esm.sh/jspdf@4.2.1',
  jszip:'https://esm.sh/jszip@3.10.1',
  xlsx:'https://esm.sh/xlsx@0.18.5',
}};

function walk(dir){
  const out=[];
  if(!existsSync(dir)) return out;
  for(const e of readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(full)); else out.push(full);
  }
  return out;
}
function sourceResolution(fromFile,spec){
  if(!spec.startsWith('.')) return spec;
  const abs=path.resolve(path.dirname(fromFile),spec);
  const variants=[
    [abs+'.ts',spec+'.js'],[abs+'.tsx',spec+'.js'],[abs+'.js',spec+'.js'],
    [path.join(abs,'index.ts'),spec.replace(/\/$/,'')+'/index.js'],
    [path.join(abs,'index.tsx'),spec.replace(/\/$/,'')+'/index.js'],
    [path.join(abs,'index.js'),spec.replace(/\/$/,'')+'/index.js'],
  ];
  if(/\.(js|mjs|json|css|png|jpg|jpeg|svg|webp)$/i.test(spec)) return spec;
  for(const [candidate,replacement] of variants){if(existsSync(candidate)) return replacement;}
  return spec;
}
function rewriteImports(js,sourceFile){
  const rewrite=(full,prefix,spec,suffix)=>`${prefix}${sourceResolution(sourceFile,spec)}${suffix}`;
  js=js.replace(/(from\s*["'])(\.[^"']+)(["'])/g,rewrite);
  js=js.replace(/(import\s*\(\s*["'])(\.[^"']+)(["']\s*\))/g,rewrite);
  js=js.replace(/(import\s*["'])(\.[^"']+)(["'])/g,rewrite);
  return js;
}
function copyTree(from,to){
  if(!existsSync(from))return;
  for(const f of walk(from)){
    const rel=path.relative(from,f),dest=path.join(to,rel);
    mkdirSync(path.dirname(dest),{recursive:true});copyFileSync(f,dest);
  }
}

rmSync(distDir,{recursive:true,force:true});
mkdirSync(outSrcDir,{recursive:true});
let count=0;
for(const input of walk(srcDir)){
  const rel=path.relative(srcDir,input);
  if(rel.includes(`${path.sep}__tests__${path.sep}`)||rel.startsWith(`reference${path.sep}`)||input.endsWith('.d.ts'))continue;
  const ext=path.extname(input).toLowerCase();
  const target=path.join(outSrcDir,rel);
  mkdirSync(path.dirname(target),{recursive:true});
  if(ext==='.ts'||ext==='.tsx'){
    const source=readFileSync(input,'utf8');
    const r=ts.transpileModule(source,{fileName:input,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,useDefineForClassFields:true,esModuleInterop:true,allowSyntheticDefaultImports:true,isolatedModules:true},reportDiagnostics:true});
    const errors=(r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    if(errors.length)throw new Error(`${rel}: ${ts.flattenDiagnosticMessageText(errors[0].messageText,'\n')}`);
    let out=r.outputText.replace(/^\s*import\s+['"][^'"]+\.css['"]\s*;?\s*$/gm,'');
    out=rewriteImports(out,input);
    writeFileSync(target.replace(/\.tsx?$/i,'.js'),out,'utf8');count++;
  }else if(ext==='.css') copyFileSync(input,target);
}
copyTree(publicDir,distDir);
const html=`<!doctype html><html lang="ko"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="color-scheme" content="light"/><title>HOWTOM 유니버스</title><link rel="stylesheet" href="/src/index.css"/><link rel="stylesheet" href="/src/control/control.css"/><script type="importmap">${JSON.stringify(importMap)}</script></head><body><div id="root"></div><script type="module" src="/src/main.js"></script></body></html>`;
writeFileSync(path.join(distDir,'index.html'),html,'utf8');
writeFileSync(path.join(distDir,'BUILD_INFO.json'),JSON.stringify({builder:'portable-esm',builtAt:new Date().toISOString(),modules:count,note:'Vite/Rollup native package unavailable 환경에서도 배포 검증 가능한 ESM production fallback build'},null,2));
console.log(`[완료] Production fallback build: ${count}개 TS/TSX → dist`);
