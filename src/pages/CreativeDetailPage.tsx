import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Badge, BadgeTone } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { MockNote } from '../components/MockNote';
import { CREATIVE_LIBRARY } from '../data/creativeLibrary';

const ORDER = CREATIVE_LIBRARY.map(c => c.id);
const TONE: Record<string, BadgeTone> = {
  노출중: 'success', 반려: 'danger', 보관됨: 'neutral',
  정상: 'success', 주의: 'warning', '교체 권장': 'danger', '데이터 부족': 'neutral',
  '성과 좋음': 'success', 보통: 'neutral', 피로: 'danger',
};

function isAssetUrl(value: string) {
  return /^(data:|blob:|https?:\/\/|\/)/i.test(value.trim());
}

export function CreativeDetailPage() {
  const { creativeId = '' } = useParams();
  const creative = CREATIVE_LIBRARY.find(c => c.id === creativeId);
  const idx = ORDER.indexOf(creativeId);
  const prevId = idx > 0 ? ORDER[idx - 1] : null;
  const nextId = idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null;

  if (!creative) {
    return (
      <div>
        <Link to="/creatives/library" className="breadcrumb-back">← 소재 라이브러리로 이동</Link>
        <div className="card">
          <EmptyState
            title={`"${creativeId}" 소재를 찾을 수 없습니다.`}
            description="소재 라이브러리에 없는 ID입니다. 목록으로 돌아가 다시 선택해 주세요."
          />
        </div>
      </div>
    );
  }

  const assetIsUrl = isAssetUrl(creative.thumb);
  const mediaClass = creative.type === '영상' ? 'video' : creative.type === '키워드' ? 'keyword' : 'image';

  return (
    <div className="creative-fullscreen-page">
      <Link to="/creatives/library" className="breadcrumb-back">← 소재 라이브러리로 이동</Link>

      <PageHeader
        title={creative.name}
        description={`${creative.brand} · ${creative.platform} · ${creative.type} · ${creative.objective}`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {prevId && <Link className="btn" to={`/creatives/library/${prevId}`}>이전 소재</Link>}
            {nextId && <Link className="btn" to={`/creatives/library/${nextId}`}>다음 소재</Link>}
          </div>
        }
      />

      <div className="creative-fullscreen-hero">
        <section className="card creative-fullscreen-media-card">
          <div className="creative-fullscreen-section-title">소재 미리보기</div>
          <div className={`creative-fullscreen-media-stage ${mediaClass}`}>
            {assetIsUrl
              ? <img src={creative.thumb} alt={creative.name} />
              : <span className="creative-fullscreen-media-symbol" aria-label={`${creative.name} 미리보기`}>{creative.thumb}</span>}
            <div className="creative-fullscreen-media-overlay">
              <span>{creative.platform}</span>
              <span>{creative.type}</span>
            </div>
          </div>
          <div className="creative-fullscreen-copy">
            <span>소재 문구</span>
            <p>{creative.copy}</p>
          </div>
        </section>

        <section className="card creative-fullscreen-info-card">
          <div className="card-title">기본 정보</div>
          <dl className="kv-grid creative-fullscreen-kv">
            <dt>소재 종류</dt><dd><span className="creative-kind-badge">{creative.type}</span></dd>
            <dt>광고 목표</dt><dd><span className="creative-objective-badge">{creative.objective}</span></dd>
            <dt>노출 상태</dt><dd><Badge tone={TONE[creative.liveStatus]}>{creative.liveStatus}</Badge></dd>
            <dt>성과 상태</dt><dd><Badge tone={TONE[creative.status]}>{creative.status}</Badge></dd>
            <dt>피로도 상태</dt><dd><Badge tone={TONE[creative.fatigue]}>{creative.fatigue}</Badge></dd>
            <dt>태그</dt><dd>{creative.tags.join(', ')}</dd>
            <dt>총 광고비</dt><dd><strong>₩{creative.spend.toLocaleString()}</strong></dd>
            <dt>사용 이력</dt><dd><strong>{creative.uses}회</strong></dd>
            <dt>최초 등록</dt><dd>{creative.date}</dd>
            <dt>관련 캠페인</dt><dd><Link to="/creatives/performance">매체별 소재 보고서에서 보기</Link></dd>
          </dl>
          <div className="creative-fullscreen-summary-grid">
            <div><span>광고주</span><strong>{creative.brand}</strong></div>
            <div><span>매체</span><strong>{creative.platform}</strong></div>
            <div><span>성과</span><strong>{creative.status}</strong></div>
          </div>
        </section>
      </div>

      <div className="card">
        <div className="card-title">피로도 이력</div>
        <EmptyState title="이력 데이터는 Phase 2에서 연결됩니다." description="FatigueHistoryEntry[] 모델 적용 예정" />
      </div>

      <div className="card">
        <div className="card-title">재등록 이력</div>
        <EmptyState title="이력 데이터는 Phase 2에서 연결됩니다." description="ReuploadHistoryEntry[] 모델 적용 예정" />
      </div>

      <div className="card">
        <div className="card-title">관련 자동화 룰</div>
        <EmptyState title="연결된 자동화 룰이 없습니다." description="AutomationRule.scope.creativeIds 기준 조회는 Phase 2 대상" />
      </div>

      <MockNote />
    </div>
  );
}
