import { useMemo, useState, type FormEvent } from 'react';
import { Check, ClipboardCopy, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAdvertisers } from '../hooks/useAdvertisers';
import {
  createPrompt, deletePrompt, loadPrompts, patchPrompt, recordPromptUse,
  type PromptCategory, type SavedPrompt,
} from '../utils/promptStore';

const CATEGORY_LABEL: Record<PromptCategory, string> = { 'ad-copy': '광고 문구', blog: '블로그', 'video-script': '영상 대본', image: '이미지', analysis: '분석', other: '기타' };

function useRevision() {
  const [rev, setRev] = useState(0);
  return [rev, () => setRev(x => x + 1)] as const;
}

export function PromptLibraryPage() {
  const [advertisers] = useAdvertisers();
  const [rev, refresh] = useRevision();
  const rows = useMemo(() => loadPrompts(), [rev]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PromptCategory | ''>('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavedPrompt | null>(null);
  const [copiedId, setCopiedId] = useState('');

  const visible = rows
    .filter(p => (!query || `${p.title} ${p.body} ${p.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())))
    .filter(p => !category || p.category === category)
    .filter(p => !favoriteOnly || p.isFavorite)
    .sort((a, b) => (b.isFavorite === a.isFavorite ? b.updatedAt.localeCompare(a.updatedAt) : b.isFavorite ? 1 : -1));

  async function copy(p: SavedPrompt) {
    try { await navigator.clipboard.writeText(p.body); } catch { /* clipboard 권한 없음 - 조용히 무시 */ }
    recordPromptUse(p.promptId);
    setCopiedId(p.promptId);
    setTimeout(() => setCopiedId(''), 1500);
    refresh();
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const advertiserId = String(f.get('advertiserId') || '') || undefined;
    const advertiserName = advertisers.find(a => a.id === advertiserId)?.name;
    const payload = {
      title: String(f.get('title') || ''), category: String(f.get('category') || 'other') as PromptCategory,
      body: String(f.get('body') || ''), tags: String(f.get('tags') || '').split(',').map(x => x.trim()).filter(Boolean),
      advertiserId, advertiserName, isFavorite: editing?.isFavorite || false,
    };
    if (editing) patchPrompt(editing.promptId, payload);
    else createPrompt(payload);
    setOpen(false); setEditing(null); refresh();
  }

  return <div className="content-system-page">
    <PageHeader title="프롬프트 저장소" description="업무별로 자주 쓰는 AI 프롬프트를 저장하고 팀과 공유합니다." action={<button className="btn primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={15} /> 새 프롬프트</button>} />
    <section className="card content-toolbar">
      <div className="content-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목·본문·태그 검색" /></div>
      <select value={category} onChange={e => setCategory(e.target.value as PromptCategory | '')}><option value="">전체 유형</option>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <button className={`btn secondary${favoriteOnly ? ' active' : ''}`} onClick={() => setFavoriteOnly(x => !x)}><Star size={14} fill={favoriteOnly ? 'currentColor' : 'none'} /> 즐겨찾기만</button>
    </section>
    <div className="content-quick-tabs">
      <button className={!category ? 'active' : ''} onClick={() => setCategory('')}>전체 <b>{rows.length}</b></button>
      {(Object.keys(CATEGORY_LABEL) as PromptCategory[]).map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{CATEGORY_LABEL[c]} <b>{rows.filter(r => r.category === c).length}</b></button>)}
    </div>
    <section className="content-template-grid">
      {visible.map(p => <article key={p.promptId} className="card content-template-card">
        <div className="content-template-top">
          <span className="content-status neutral">{CATEGORY_LABEL[p.category]}</span>
          <button onClick={() => { patchPrompt(p.promptId, { isFavorite: !p.isFavorite }); refresh(); }}><Star size={17} fill={p.isFavorite ? 'currentColor' : 'none'} /></button>
        </div>
        <h3>{p.title}</h3>
        <p style={{ whiteSpace: 'pre-wrap', maxHeight: 96, overflow: 'hidden' }}>{p.body}</p>
        <div className="content-template-blocks">{p.tags.map(t => <small key={t}>#{t}</small>)}</div>
        <div className="content-template-meta"><span>{p.advertiserName || '공용'}</span><span>사용 {p.useCount}회</span></div>
        <div className="content-card-actions">
          <button onClick={() => copy(p)}>{copiedId === p.promptId ? <><Check size={14} /> 복사됨</> : <><ClipboardCopy size={14} /> 복사</>}</button>
          <button onClick={() => { setEditing(p); setOpen(true); }}>수정</button>
          <button className="danger" onClick={() => { if (confirm('이 프롬프트를 삭제할까요?')) { deletePrompt(p.promptId); refresh(); } }}><Trash2 size={14} /></button>
        </div>
      </article>)}
      {!visible.length && <div className="content-empty">조건에 맞는 프롬프트가 없습니다. 새 프롬프트를 등록해보세요.</div>}
    </section>
    {open && <div className="content-modal-backdrop" onClick={() => setOpen(false)}>
      <form className="content-modal" onSubmit={submit} onClick={e => e.stopPropagation()}>
        <div className="content-modal-head"><div><h3>{editing ? '프롬프트 수정' : '새 프롬프트'}</h3><p>반복해서 쓰는 프롬프트를 저장해두면 다음에 바로 복사해 쓸 수 있습니다.</p></div><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
        <div className="content-form-grid">
          <label>제목<input name="title" required defaultValue={editing?.title || ''} /></label>
          <label>유형<select name="category" defaultValue={editing?.category || 'other'}>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>광고주<select name="advertiserId" defaultValue={editing?.advertiserId || ''}><option value="">공용</option>{advertisers.filter(a => a.id !== 'default').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label className="span2">태그<input name="tags" placeholder="쉼표로 구분" defaultValue={editing?.tags.join(', ') || ''} /></label>
          <label className="span2">프롬프트 본문<textarea name="body" rows={8} required defaultValue={editing?.body || ''} /></label>
        </div>
        <div className="content-modal-actions"><button type="button" className="btn secondary" onClick={() => setOpen(false)}>취소</button><button className="btn primary">저장</button></div>
      </form>
    </div>}
  </div>;
}
