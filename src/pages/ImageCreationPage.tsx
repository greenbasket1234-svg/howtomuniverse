import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ChevronLeft, Download, ImagePlus, Save, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { loadProjects, patchProject } from '../utils/contentStore';
import { createAssetsFromFiles, patchAsset } from '../utils/assetStore';
import { loadAdvertisers } from '../data/advertisers';
import { imageApi, type GeneratedImage, type ImagePlanInput } from '../features/image/imageApi';

const VISUAL_TYPES = ['제품 단독컷', '모델 착용컷', '라이프스타일', '비교·후기형', '인포그래픽', '일러스트'];
const RATIOS = [{ key: '1:1', label: '1:1 정방형' }, { key: '9:16', label: '9:16 세로(스토리/릴스)' }, { key: '16:9', label: '16:9 가로' }];

/** data:URL(base64) 또는 원격 URL을 실제 File 객체로 바꿉니다 - 기존 자산관리 업로드 파이프라인을 그대로 재사용하기 위해서입니다. */
async function toFile(image: GeneratedImage, index: number): Promise<File> {
  const name = `ai-image-${Date.now()}-${index}.png`;
  if (image.base64) {
    const bin = atob(image.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: 'image/png' });
  }
  if (image.url) {
    const res = await fetch(image.url);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || 'image/png' });
  }
  throw new Error('이미지 데이터가 없습니다.');
}

export function ImageCreationPage() {
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
  const project = useMemo(() => projectId ? loadProjects().find(p => p.projectId === projectId) : undefined, [projectId]);
  const advertisers = loadAdvertisers();
  const advertiser = advertisers.find(a => a.id === project?.advertiserId);

  const [plan, setPlan] = useState<ImagePlanInput>(() => ({
    visualType: project?.imagePlan?.visualType || '', subject: project?.imagePlan?.subject || '',
    background: project?.imagePlan?.background || '', mainText: project?.imagePlan?.mainText || '',
    ratio: project?.imagePlan?.ratio || '1:1', extraPrompt: '',
  }));
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; provider: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState('');

  useEffect(() => { imageApi.aiStatus().then(setAiStatus).catch(() => setAiStatus({ configured: false, provider: null })); }, []);

  function patch<K extends keyof ImagePlanInput>(key: K, value: ImagePlanInput[K]) {
    setPlan(prev => ({ ...prev, [key]: value }));
  }

  async function generate() {
    if (!plan.subject && !plan.extraPrompt) { setError('메인 피사체 또는 추가 요청 중 하나는 입력하세요.'); return; }
    setLoading(true); setError(''); setResults([]); setSavedIndexes(new Set());
    try {
      const res = await imageApi.generate(plan);
      setResults(res.images);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 이미지 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function saveToAssets(image: GeneratedImage, index: number) {
    setNotice('');
    try {
      const file = await toFile(image, index);
      const created = await createAssetsFromFiles([file], {
        advertiserId: project?.advertiserId,
        tags: ['AI 이미지 제작', plan.visualType].filter((x): x is string => Boolean(x)),
        status: 'draft',
        description: image.revisedPrompt,
      });
      const asset = created[0];
      if (asset && project) {
        patchAsset(asset.assetId, {
          sourceType: 'content', sourceId: project.projectId,
          relationLabels: [`콘텐츠 → 이미지 제작 · ${project.title}`],
          campaignId: project.campaignId, campaignName: project.campaignName, channel: project.channel,
        });
        patchProject(project.projectId, { resultAssetIds: Array.from(new Set([...(project.resultAssetIds || []), asset.assetId])) });
      }
      setSavedIndexes(prev => new Set(prev).add(index));
      setNotice('자산관리에 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '자산 저장에 실패했습니다.');
    }
  }

  return <div className="content-system-page">
    <PageHeader
      title="이미지 제작"
      description="기획 정보를 바탕으로 AI 이미지를 생성하고, 마음에 드는 결과만 골라 자산관리에 저장합니다."
      action={project ? <Link className="btn secondary" to={`/content/ad-creation?project=${encodeURIComponent(project.projectId)}`}><ChevronLeft size={14} /> 광고 제작으로 돌아가기</Link> : undefined}
    />
    {project && <div className="content-source-brief-sm"><ImagePlus size={16} /><span><b>{project.title}</b>{advertiser ? ` · ${advertiser.name}` : ''}의 이미지 기획에서 넘어왔습니다.</span></div>}
    {aiStatus && !aiStatus.configured && <div className="content-notice warning"><AlertTriangle size={15} /> AI 이미지 생성이 아직 연결되지 않았습니다(관리자가 서버에 이미지 AI API를 연결하면 사용할 수 있습니다). 아래 기획 내용은 저장되며, 연결 후 바로 생성을 시도할 수 있습니다.</div>}
    {notice && <div className="content-notice">{notice}</div>}
    {error && <div className="content-notice danger">{error}</div>}

    <section className="card content-section">
      <div className="content-section-head"><div><span>01</span><h3>이미지 기획</h3></div><small>비워두면 광고 제작 화면의 기획값을 기본으로 씁니다.</small></div>
      <div className="content-form-grid">
        <label>표현 방식<select value={plan.visualType} onChange={e => patch('visualType', e.target.value)}><option value="">선택</option>{VISUAL_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>비율<select value={plan.ratio} onChange={e => patch('ratio', e.target.value)}>{RATIOS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
        <label>메인 피사체<input value={plan.subject} onChange={e => patch('subject', e.target.value)} placeholder="예: 화장품 병 클로즈업" /></label>
        <label>배경<input value={plan.background} onChange={e => patch('background', e.target.value)} placeholder="예: 밝은 파스텔톤 스튜디오" /></label>
        <label className="span2">메인 문구(참고용)<input value={plan.mainText} onChange={e => patch('mainText', e.target.value)} placeholder="이미지 안에 들어갔으면 하는 문구 - AI 텍스트 렌더링은 부정확할 수 있습니다" /></label>
        <label className="span2">추가 요청<textarea rows={3} value={plan.extraPrompt} onChange={e => patch('extraPrompt', e.target.value)} placeholder="색감, 조명, 분위기, 참고 레퍼런스 등 자유롭게 적어주세요" /></label>
      </div>
      <div className="content-final-actions">
        <button className="btn primary" onClick={generate} disabled={loading}><Sparkles size={15} /> {loading ? '생성 중...' : 'AI 이미지 생성'}</button>
      </div>
    </section>

    {results.length > 0 && <section className="card content-section">
      <div className="content-section-head"><div><span>02</span><h3>생성 결과</h3></div><small>마음에 드는 이미지만 자산관리에 저장하세요.</small></div>
      <div className="image-creation-results">
        {results.map((img, i) => (
          <article key={i} className="image-creation-result">
            {img.url || img.base64 ? <img src={img.url || `data:image/png;base64,${img.base64}`} alt={`생성 이미지 ${i + 1}`} /> : <div className="image-creation-noimg">이미지 없음</div>}
            <p>{img.revisedPrompt}</p>
            <div className="content-final-actions">
              {img.url && <a className="btn secondary" href={img.url} target="_blank" rel="noreferrer"><Download size={14} /> 원본 보기</a>}
              <button className="btn primary" onClick={() => saveToAssets(img, i)} disabled={savedIndexes.has(i)}>
                <Save size={14} /> {savedIndexes.has(i) ? '저장됨' : '자산으로 저장'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>}

    {project && <Link className="btn secondary content-inline-action" to={`/content/ad-creation?project=${encodeURIComponent(project.projectId)}`}>광고 제작으로 돌아가기 <ArrowRight size={14} /></Link>}
  </div>;
}
