import type { BlogProject } from './blogTypes';

export function blogPlainText(project: BlogProject) {
  return project.blocks.map(block => [block.title, block.text].filter(Boolean).join('\n')).join('\n\n');
}
export function analyzeBlogSeo(project: BlogProject) {
  const keyword=project.primaryKeyword.trim();
  const title=(project.selectedTitle||'').trim();
  const body=blogPlainText(project);
  const first=project.blocks.find(b=>b.type==='paragraph')?.text||'';
  const hBlocks=project.blocks.filter(b=>b.type==='h2'||b.type==='h3');
  const compact=body.replace(/\s/g,'');
  const target=Math.max(500,project.targetLength||2000);
  const keywordCount=keyword ? body.split(keyword).length-1 : 0;
  const checks=[
    {label:'제목에 메인 키워드',ok:!!keyword&&title.includes(keyword),points:20},
    {label:'도입부에 메인 키워드',ok:!!keyword&&first.includes(keyword),points:15},
    {label:'소제목에 메인 키워드',ok:!!keyword&&hBlocks.some(b=>`${b.title||''} ${b.text||''}`.includes(keyword)),points:15},
    {label:'목표 글자수 80% 이상',ok:compact.length>=target*.8,points:20},
    {label:'소제목 2개 이상',ok:hBlocks.length>=2,points:10},
    {label:'FAQ 포함',ok:project.blocks.some(b=>b.type==='faq'),points:5},
    {label:'CTA 포함',ok:project.blocks.some(b=>b.type==='cta'),points:5},
    {label:'이미지 배치',ok:project.blocks.some(b=>b.type==='image'&&b.assetId),points:5},
    {label:'키워드 과다 반복 없음',ok:!keyword||keywordCount<=Math.max(8,Math.ceil(compact.length/400)),points:5},
  ];
  return {score:checks.reduce((n,c)=>n+(c.ok?c.points:0),0),checks,length:compact.length,keywordCount};
}
