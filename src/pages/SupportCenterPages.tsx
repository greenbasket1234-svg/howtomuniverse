import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Plus, Search, X, Trash2, ShieldCheck, FileText, Users, AlertTriangle, BookOpen, Megaphone, Handshake, ClipboardList, Lock, Bold, Italic, List, ListOrdered, Heading2, ImagePlus, History, Link2, Calendar as CalendarIcon } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import {
  loadSupportDocs, saveSupportDocs, deleteSupportDoc,
  SUPPORT_STATUS_LABEL, type SupportDoc, type SupportDocStatus, type SupportDocAttachment,
  loadCredentials, saveCredentials, loadCredentialLogs, appendCredentialLog, type CredentialEntry,
} from '../utils/supportCenterData';
import { useAdvertisers } from '../hooks/useAdvertisers';
import { adControlRepository } from '../repositories';
import { matchesAdvertiserFilter } from '../utils/advertiserMatch';
import { loadAllGeneratedReports } from '../features/reports/reportCore';

const STATUS_OPTIONS: SupportDocStatus[] = ['draft', 'organized', 'in_progress', 'resolved', 'archived'];

// 리치 텍스트 에디터로 만든 HTML을 저장하기 직전과, 다른 화면에서 그 HTML을 다시 그릴 때
// 둘 다 이 함수를 거치게 합니다. 붙여넣기 등으로 악성 스크립트·이벤트 속성이 섞여 들어와도
// 실행되지 않도록, 서식에 필요한 태그(글자 굵기·기울임·목록·소제목·문단)만 허용합니다.
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'h4', 'div', 'span'],
    ALLOWED_ATTR: [],
  });
}

// 별도 라이브러리 없이 contentEditable + execCommand로 최소한의 서식(굵게·기울임·목록·
// 소제목)을 지원하는 가벼운 리치 텍스트 에디터입니다. body는 HTML 문자열로 저장됩니다.
function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 4, padding: 6, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <button type="button" className="icon-btn" title="굵게" onMouseDown={e => { e.preventDefault(); exec('bold'); }}><Bold size={14} /></button>
        <button type="button" className="icon-btn" title="기울임" onMouseDown={e => { e.preventDefault(); exec('italic'); }}><Italic size={14} /></button>
        <button type="button" className="icon-btn" title="소제목" onMouseDown={e => { e.preventDefault(); exec('formatBlock', '<h4>'); }}><Heading2 size={14} /></button>
        <button type="button" className="icon-btn" title="글머리 목록" onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}><List size={14} /></button>
        <button type="button" className="icon-btn" title="번호 목록" onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }}><ListOrdered size={14} /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        style={{ minHeight: 140, padding: 10, fontSize: 13, lineHeight: 1.7, outline: 'none' }}
      />
    </div>
  );
}

// 이미지를 localStorage에 저장할 수 있는 크기로 압축합니다(캔버스로 리사이즈 후 JPEG
// 재인코딩). 원본을 그대로 base64로 저장하면 사진 몇 장만으로도 저장 공간을 다 써버릴
// 수 있어서, 가로 1200px 이하·품질 0.72로 줄입니다.
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1200 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('캔버스를 사용할 수 없습니다.')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function newDocDraft(categoryKey: string): SupportDoc {
  const now = new Date().toISOString();
  return { id: `doc-${Date.now()}`, categoryKey, title: '', body: '', status: 'draft', tags: [], owner: '', createdAt: now, updatedAt: now };
}

// 지식 라이브러리·영업 문서·업무 운영·사내 소식이 공통으로 쓰는 3단 레이아웃입니다.
// 왼쪽 카테고리 탭 → 가운데 문서 목록 → 오른쪽(선택 시) 상세/편집.
function DocumentBoard({
  title, description, categories, showQuoteFields, showAdvertiserField, showFollowUpField,
}: {
  title: string;
  description: string;
  categories: { key: string; label: string; icon: React.ReactNode }[];
  showQuoteFields?: boolean;
  showAdvertiserField?: boolean;
  showFollowUpField?: boolean;
}) {
  const [docs, setDocs] = useState<SupportDoc[]>(() => loadSupportDocs());
  const [advertisers] = useAdvertisers();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.key ?? '');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SupportDoc | null>(null);

  const persist = (next: SupportDoc[]) => { setDocs(next); saveSupportDocs(next); };

  const filtered = useMemo(
    () => docs.filter(d => d.categoryKey === activeCategory && (d.title.includes(query) || d.body.includes(query))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [docs, activeCategory, query]
  );
  const selected = docs.find(d => d.id === selectedId) ?? null;

  const [historyDoc, setHistoryDoc] = useState<SupportDoc | null>(null);
  const openNew = () => setEditing(newDocDraft(activeCategory));
  const openEdit = (doc: SupportDoc) => setEditing({ ...doc });
  const save = () => {
    if (!editing || !editing.title.trim()) return;
    const original = docs.find(d => d.id === editing.id);
    // 기존 문서를 수정하는 경우, 저장 직전 상태를 버전 이력에 남깁니다. 그래야 "누가 언제
    // 무엇을 바꿨는지"를 나중에 되짚어 볼 수 있습니다(최근 20개만 보관).
    const history = original && (original.title !== editing.title || original.body !== editing.body)
      ? [{ versionAt: original.updatedAt, title: original.title, body: original.body, editedBy: original.owner || '알 수 없음' }, ...(original.history ?? [])].slice(0, 20)
      : editing.history ?? [];
    const next = { ...editing, body: sanitizeHtml(editing.body), history, updatedAt: new Date().toISOString() };
    persist(docs.some(d => d.id === next.id) ? docs.map(d => d.id === next.id ? next : d) : [...docs, next]);
    setSelectedId(next.id);
    setEditing(null);
  };
  const remove = (id: string) => {
    if (!window.confirm('이 문서를 삭제할까요?')) return;
    persist(docs.filter(d => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const [attachError, setAttachError] = useState('');
  const handleAttach = async (files: FileList | null) => {
    if (!files || !editing) return;
    setAttachError('');
    try {
      const compressed = await Promise.all(Array.from(files).map(async file => ({ id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: file.name, dataUrl: await compressImage(file) })));
      setEditing(prev => prev ? { ...prev, attachments: [...(prev.attachments ?? []), ...compressed] } : prev);
    } catch {
      setAttachError('이미지를 첨부하지 못했습니다. 다른 파일로 다시 시도해 주세요.');
    }
  };
  const removeAttachment = (id: string) => setEditing(prev => prev ? { ...prev, attachments: (prev.attachments ?? []).filter(a => a.id !== id) } : prev);

  return (
    <>
      <PageHeader title={title} description={description} action={<button className="btn primary" onClick={openNew}><Plus size={15} /> 새 문서</button>} />
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 8 }}>
          {categories.map(c => (
            <button key={c.key} onClick={() => { setActiveCategory(c.key); setSelectedId(null); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, border: 'none', background: activeCategory === c.key ? '#eff6ff' : 'transparent', color: activeCategory === c.key ? '#1d4ed8' : '#334155', fontWeight: activeCategory === c.key ? 700 : 500, fontSize: 13, cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}>
              {c.icon}{c.label}
            </button>
          ))}
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="search-input-wrap" style={{ marginBottom: 10 }}><Search size={14} /><input className="search-input" placeholder="제목·내용 검색" value={query} onChange={e => setQuery(e.target.value)} /></div>
          {filtered.length === 0 && <p className="muted" style={{ padding: 16 }}>등록된 문서가 없습니다.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(d => (
              <button key={d.id} onClick={() => setSelectedId(d.id)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: selectedId === d.id ? '#eff6ff' : '#fff', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b style={{ fontSize: 13 }}>{d.title}</b>
                  <span className="status-pill" style={{ fontSize: 10.5 }}>{SUPPORT_STATUS_LABEL[d.status]}</span>
                </div>
                <small style={{ color: '#94a3b8' }}>{d.owner || '담당자 미지정'} · {new Date(d.updatedAt).toLocaleDateString('ko-KR')}{d.advertiserName ? ` · ${d.advertiserName}` : ''}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 16, minHeight: 200 }}>
          {!selected && <p className="muted">왼쪽 목록에서 문서를 선택하면 내용을 볼 수 있습니다.</p>}
          {selected && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><h3 style={{ margin: 0 }}>{selected.title}</h3><small style={{ color: '#94a3b8' }}>{selected.owner || '담당자 미지정'} · 최근 수정 {new Date(selected.updatedAt).toLocaleString('ko-KR')}</small></div>
                <div style={{ display: 'flex', gap: 6 }}>{(selected.history?.length ?? 0) > 0 && <button className="icon-btn" title="버전 이력" onClick={() => setHistoryDoc(selected)}><History size={15} /></button>}<button className="icon-btn" onClick={() => openEdit(selected)}><FileText size={15} /></button><button className="icon-btn danger" onClick={() => remove(selected.id)}><Trash2 size={15} /></button></div>
              </div>
              <div style={{ margin: '10px 0' }}><span className="status-pill">{SUPPORT_STATUS_LABEL[selected.status]}</span>{selected.tags.map(t => <span key={t} className="status-pill" style={{ marginLeft: 6, background: '#f1f5f9' }}>#{t}</span>)}</div>
              {selected.advertiserName && <p style={{ fontSize: 12.5, color: '#475569' }}>광고주: <b>{selected.advertiserName}</b></p>}
              {selected.quoteMeta && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12.5 }}>
                  <div>전달일: <b>{selected.quoteMeta.deliveredAt || '-'}</b></div>
                  <div>유효기간: <b>{selected.quoteMeta.validUntil || '-'}</b></div>
                  <div>수락·거절: <b>{selected.quoteMeta.decision || '검토중'}</b></div>
                  {selected.linkUrl && <div>네이버 웍스 문서: <a href={selected.linkUrl} target="_blank" rel="noreferrer">열기 →</a></div>}
                </div>
              )}
              {selected.followUpAt && <p style={{ fontSize: 12.5, color: '#b45309' }}>후속 조치 예정일: <b>{selected.followUpAt}</b></p>}
              {selected.categoryKey === 'handover' && selected.advertiserName && <HandoverLinkedData advertiserName={selected.advertiserName} />}
              <div style={{ fontSize: 13, lineHeight: 1.7, color: '#334155' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.body || '<p style="color:#94a3b8">(내용 없음)</p>') }} />
              {(selected.attachments?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {selected.attachments!.map(a => (
                    <a key={a.id} href={a.dataUrl} target="_blank" rel="noreferrer" title={a.name}>
                      <img src={a.dataUrl} alt={a.name} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-head"><h3>{docs.some(d => d.id === editing.id) ? '문서 수정' : '새 문서 작성'}</h3><button className="icon-btn" onClick={() => setEditing(null)}><X size={18} /></button></div>
            <label className="field-label">제목<input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></label>
            <label className="field-label">내용</label>
            <RichTextEditor value={editing.body} onChange={html => setEditing(prev => prev ? { ...prev, body: html } : prev)} />
            <label className="field-label" style={{ marginTop: 10 }}>사진 첨부
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <label className="btn secondary sm" style={{ cursor: 'pointer' }}><ImagePlus size={13} /> 이미지 추가<input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleAttach(e.target.files)} /></label>
                {(editing.attachments ?? []).map(a => (
                  <div key={a.id} style={{ position: 'relative' }}>
                    <img src={a.dataUrl} alt={a.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    <button type="button" onClick={() => removeAttachment(a.id)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 999, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
              {attachError && <small style={{ color: '#dc2626' }}>{attachError}</small>}
            </label>
            <div className="settings-form-grid">
              <label className="field-label">상태<select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as SupportDocStatus })}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{SUPPORT_STATUS_LABEL[s]}</option>)}</select></label>
              <label className="field-label">담당자<input value={editing.owner} onChange={e => setEditing({ ...editing, owner: e.target.value })} /></label>
              <label className="field-label">태그(쉼표로 구분)<input value={editing.tags.join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} /></label>
              {showAdvertiserField && <label className="field-label">관련 광고주<input list="support-advertisers" value={editing.advertiserName ?? ''} onChange={e => setEditing({ ...editing, advertiserName: e.target.value })} /><datalist id="support-advertisers">{advertisers.map(a => <option key={a.id} value={a.name} />)}</datalist></label>}
              {showFollowUpField && <label className="field-label">후속 조치 예정일<input type="date" value={editing.followUpAt ?? ''} onChange={e => setEditing({ ...editing, followUpAt: e.target.value })} /></label>}
            </div>
            {showQuoteFields && (
              <div className="settings-form-grid">
                <label className="field-label">광고주 전달일<input type="date" value={editing.quoteMeta?.deliveredAt ?? ''} onChange={e => setEditing({ ...editing, quoteMeta: { ...editing.quoteMeta, deliveredAt: e.target.value } })} /></label>
                <label className="field-label">견적 유효기간<input type="date" value={editing.quoteMeta?.validUntil ?? ''} onChange={e => setEditing({ ...editing, quoteMeta: { ...editing.quoteMeta, validUntil: e.target.value } })} /></label>
                <label className="field-label">수락·거절 여부<select value={editing.quoteMeta?.decision ?? '검토중'} onChange={e => setEditing({ ...editing, quoteMeta: { ...editing.quoteMeta, decision: e.target.value as '검토중'|'수락'|'거절' } })}><option value="검토중">검토중</option><option value="수락">수락</option><option value="거절">거절</option></select></label>
                <label className="field-label">네이버 웍스 문서 링크<input value={editing.linkUrl ?? ''} onChange={e => setEditing({ ...editing, linkUrl: e.target.value })} placeholder="계약서·세금계산서 등" /></label>
              </div>
            )}
            <div className="modal-actions"><button className="btn secondary" onClick={() => setEditing(null)}>취소</button><button className="btn primary" onClick={save}>저장</button></div>
          </div>
        </div>
      )}
      {historyDoc && (
        <div className="modal-backdrop" onClick={() => setHistoryDoc(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-head"><h3>{historyDoc.title} · 버전 이력</h3><button className="icon-btn" onClick={() => setHistoryDoc(null)}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {(historyDoc.history ?? []).length === 0 && <p className="muted">이전 버전 기록이 없습니다.</p>}
              {(historyDoc.history ?? []).map((v, index) => (
                <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}><span>{new Date(v.versionAt).toLocaleString('ko-KR')} · {v.editedBy}</span></div>
                  <b style={{ fontSize: 13 }}>{v.title}</b>
                  <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4, maxHeight: 100, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(v.body) }} />
                </div>
              ))}
            </div>
            <div className="modal-actions"><button className="btn secondary" onClick={() => setHistoryDoc(null)}>닫기</button></div>
          </div>
        </div>
      )}
    </>
  );
}

// 업무 인수인계 문서에 광고주를 지정하면, 그 광고주와 연결된 보고서·운영 일정·계정 정보를
// 자동으로 모아서 보여줍니다. 인수인계자가 여기저기 흩어진 자료를 따로 찾아다니지 않도록
// 하는 것이 목적입니다.
function HandoverLinkedData({ advertiserName }: { advertiserName: string }) {
  const [advertisers] = useAdvertisers();
  const reports = loadAllGeneratedReports().filter(r => r.advertiserName === advertiserName).slice(0, 5);
  const [schedules, setSchedules] = useState<{ id: string; title: string }[] | null>(null);
  useEffect(() => {
    let active = true;
    // 운영 캘린더에서 새로 추가·수정한 일정이 여기에도 반영되도록, 정적 예시 데이터가 아니라
    // 실제 저장소(adControlRepository)에서 최신 일정을 불러옵니다.
    adControlRepository.getScheduleSlots()
      .then(rows => {
        if (!active) return;
        const matched = rows.filter(s => {
          const adv = advertisers.find(a => a.id === s.advertiserId);
          return adv && matchesAdvertiserFilter(adv.name, advertiserName);
        }).slice(0, 5);
        setSchedules(matched);
      })
      .catch(() => { if (active) setSchedules([]); });
    return () => { active = false; };
  }, [advertiserName]);
  const credentials = loadCredentials().filter(c => c.scope === 'advertiser' && c.advertiserName === advertiserName);
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, margin: '10px 0', fontSize: 12.5 }}>
      <b style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><Link2 size={14} /> {advertiserName} 연결 자료 자동 요약</b>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div><small style={{ color: '#94a3b8' }}>최근 저장 보고서</small>{reports.length === 0 ? <p style={{ color: '#94a3b8', margin: '4px 0 0' }}>없음</p> : <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>{reports.map(r => <li key={r.id}>{r.month} · {r.reportName || '보고서'}</li>)}</ul>}</div>
        <div><small style={{ color: '#94a3b8' }}>운영 일정</small>{schedules === null ? <p style={{ color: '#94a3b8', margin: '4px 0 0' }}>불러오는 중...</p> : schedules.length === 0 ? <p style={{ color: '#94a3b8', margin: '4px 0 0' }}>없음</p> : <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>{schedules.map(s => <li key={s.id}><CalendarIcon size={10} style={{ marginRight: 3 }} />{s.title}</li>)}</ul>}</div>
        <div><small style={{ color: '#94a3b8' }}>연결된 계정</small>{credentials.length === 0 ? <p style={{ color: '#94a3b8', margin: '4px 0 0' }}>없음</p> : <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>{credentials.map(c => <li key={c.id}><Lock size={10} style={{ marginRight: 3 }} />{c.serviceName}</li>)}</ul>}</div>
      </div>
      <Link to="/support/security" className="footnote" style={{ display: 'block', marginTop: 8 }}>계정 보안에서 전체 계정 정보 확인 →</Link>
    </div>
  );
}

export function SupportKnowledgePage() {
  return <DocumentBoard title="지식 라이브러리" description="매체별 세팅 매뉴얼, Q&A, 소재 레퍼런스와 가이드라인, 교육·온보딩 자료, 템플릿, 사내 정책을 한 곳에 모읍니다."
    categories={[
      { key: 'setting-manual', label: '매체별 세팅 매뉴얼', icon: <BookOpen size={14} /> },
      { key: 'faq', label: '광고주 자주 묻는 Q&A', icon: <BookOpen size={14} /> },
      { key: 'creative-reference', label: '소재 레퍼런스', icon: <BookOpen size={14} /> },
      { key: 'creative-guideline', label: '소재 제작 가이드라인', icon: <BookOpen size={14} /> },
      { key: 'onboarding', label: '교육·온보딩', icon: <BookOpen size={14} /> },
      { key: 'template', label: '템플릿센터', icon: <BookOpen size={14} /> },
      { key: 'policy', label: '사내 정책·업무 규정', icon: <BookOpen size={14} /> },
    ]} />;
}

export function SupportSalesPage() {
  return <DocumentBoard title="영업 문서" description="견적서는 작성·검토·발행·전달까지만 담당합니다. 계약·세금계산서·정산은 네이버 웍스에서 이어서 관리해 주세요."
    showQuoteFields showAdvertiserField
    categories={[
      { key: 'quote', label: '견적서', icon: <Handshake size={14} /> },
      { key: 'proposal', label: '제안서', icon: <Handshake size={14} /> },
      { key: 'partner', label: '협력사·외주 관리', icon: <Handshake size={14} /> },
    ]} />;
}

export function SupportOpsPage() {
  return <DocumentBoard title="업무 운영" description="회의록, 광고주 커뮤니케이션 기록, 캠페인 실험·회고, 장애·이슈, 인수인계를 기록과 지식 축적 중심으로 관리합니다."
    showAdvertiserField showFollowUpField
    categories={[
      { key: 'meeting', label: '회의록·결정사항', icon: <ClipboardList size={14} /> },
      { key: 'communication', label: '광고주 커뮤니케이션 기록', icon: <Users size={14} /> },
      { key: 'experiment', label: '캠페인 실험·회고', icon: <ClipboardList size={14} /> },
      { key: 'incident', label: '장애·이슈 관리', icon: <AlertTriangle size={14} /> },
      { key: 'handover', label: '업무 인수인계', icon: <ClipboardList size={14} /> },
    ]} />;
}

export function SupportNewsPage() {
  return <DocumentBoard title="사내 소식" description="팀 전체에 공유할 공지사항을 모아둡니다."
    categories={[{ key: 'notice', label: '기타 공지사항', icon: <Megaphone size={14} /> }]} />;
}

// 계정 보안: 프론트엔드 단계에서는 서비스명·계정 ID·담당자·변경 주기만 관리합니다.
// 실제 비밀번호/API Secret은 localStorage에 저장하지 않습니다.
export function SupportSecurityPage() {
  const [advertisers] = useAdvertisers();
  const [items, setItems] = useState<CredentialEntry[]>(() => loadCredentials());
  const [scope, setScope] = useState<'company' | 'advertiser'>('company');
  const [editing, setEditing] = useState<CredentialEntry | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  const persist = (next: CredentialEntry[]) => { setItems(next); saveCredentials(next); };
  const filtered = items.filter(i => i.scope === scope);

  const openNew = () => setEditing({ id: `cred-${Date.now()}`, scope, serviceName: '', accountId: '', memo: '', lastChangedAt: new Date().toISOString().slice(0, 10), owner: '' });
  const save = () => {
    if (!editing || !editing.serviceName.trim()) return;
    const isNew = !items.some(i => i.id === editing.id);
    persist(isNew ? [...items, editing] : items.map(i => i.id === editing.id ? editing : i));
    if (!isNew) appendCredentialLog({ id: `log-${Date.now()}`, credentialId: editing.id, action: '변경', actor: '나', at: new Date().toISOString() });
    setEditing(null);
  };
  const remove = (id: string) => { if (window.confirm('이 계정 정보를 삭제할까요?')) persist(items.filter(i => i.id !== id)); };

  return (
    <>
      <PageHeader title="계정 보안" description="회사·광고주 계정의 서비스명·ID·담당자·변경 주기만 관리합니다. 실제 비밀번호와 API Secret은 서버 보안 저장소 구축 전까지 저장하지 않습니다." action={<div style={{ display: 'flex', gap: 8 }}><button className="btn secondary" onClick={() => setLogsOpen(true)}><ShieldCheck size={15} /> 변경 로그</button><button className="btn primary" onClick={openNew}><Plus size={15} /> 계정 추가</button></div>} />
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>이 화면은 브라우저 저장 기반 시험판입니다. <b>실제 비밀번호·API Secret은 입력하거나 저장하지 않습니다.</b> 현재는 계정 식별 정보와 변경 주기만 관리하며, 자격증명 저장은 회사 서버 인증·권한검사·암호화 저장소 구축 후 연결됩니다.</span>
      </div>
      <div className="channel-switch-tabs" style={{ marginBottom: 14 }}>
        <button className={scope === 'company' ? 'active' : ''} onClick={() => setScope('company')}>회사 계정 보관함</button>
        <button className={scope === 'advertiser' ? 'active' : ''} onClick={() => setScope('advertiser')}>광고주 계정 보관함</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="ops-table">
          <thead><tr><th>서비스</th>{scope === 'advertiser' && <th>광고주</th>}<th>계정 ID</th><th>자격증명</th><th>최근 변경</th><th>변경 예정</th><th>담당자</th><th></th></tr></thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id}>
                <td><Lock size={12} style={{ marginRight: 5, color: '#94a3b8' }} />{item.serviceName}</td>
                {scope === 'advertiser' && <td>{item.advertiserName || '-'}</td>}
                <td>{item.accountId}</td>
                <td><span className="settings-status">서버 연결 후</span></td>
                <td>{item.lastChangedAt}</td>
                <td>{item.changeDueAt || '-'}</td>
                <td>{item.owner || '-'}</td>
                <td><div className="row-actions"><button className="icon-btn" onClick={() => setEditing(item)}><FileText size={14} /></button><button className="icon-btn danger" onClick={() => remove(item.id)}><Trash2 size={14} /></button></div></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>등록된 계정이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><h3>계정 정보</h3><button className="icon-btn" onClick={() => setEditing(null)}><X size={18} /></button></div>
            <label className="field-label">서비스명<input value={editing.serviceName} onChange={e => setEditing({ ...editing, serviceName: e.target.value })} /></label>
            {scope === 'advertiser' && <label className="field-label">광고주<input list="support-advertisers-2" value={editing.advertiserName ?? ''} onChange={e => setEditing({ ...editing, advertiserName: e.target.value })} /><datalist id="support-advertisers-2">{advertisers.map(a => <option key={a.id} value={a.name} />)}</datalist></label>}
            <label className="field-label">계정 ID<input value={editing.accountId} onChange={e => setEditing({ ...editing, accountId: e.target.value })} /></label>
            <label className="field-label">비밀번호 / API Secret<input value="" disabled placeholder="서버 보안 저장소 연결 후 사용 가능" /></label>
            <label className="field-label">최근 변경일<input type="date" value={editing.lastChangedAt} onChange={e => setEditing({ ...editing, lastChangedAt: e.target.value })} /></label>
            <label className="field-label">변경 예정일<input type="date" value={editing.changeDueAt ?? ''} onChange={e => setEditing({ ...editing, changeDueAt: e.target.value })} /></label>
            <label className="field-label">담당자<input value={editing.owner} onChange={e => setEditing({ ...editing, owner: e.target.value })} /></label>
            <label className="field-label">메모<textarea rows={3} value={editing.memo} onChange={e => setEditing({ ...editing, memo: e.target.value })} /></label>
            <div className="modal-actions"><button className="btn secondary" onClick={() => setEditing(null)}>취소</button><button className="btn primary" onClick={save}>저장</button></div>
          </div>
        </div>
      )}
      {logsOpen && (
        <div className="modal-backdrop" onClick={() => setLogsOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><h3>변경 로그</h3><button className="icon-btn" onClick={() => setLogsOpen(false)}><X size={18} /></button></div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {loadCredentialLogs().map(log => {
                const cred = items.find(i => i.id === log.credentialId);
                return <div key={log.id} style={{ fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>{new Date(log.at).toLocaleString('ko-KR')} · {cred?.serviceName ?? '삭제된 계정'} · {log.action} · {log.actor}</div>;
              })}
              {loadCredentialLogs().length === 0 && <p className="muted">기록이 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function SupportHubPage() {
  const docs = loadSupportDocs();
  const credentials = loadCredentials();
  const recentDocs = [...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const unresolvedIncidents = docs.filter(d => d.categoryKey === 'incident' && d.status !== 'resolved');
  const activeHandovers = docs.filter(d => d.categoryKey === 'handover' && d.status === 'in_progress');
  const upcomingFollowUps = docs.filter(d => d.followUpAt).sort((a, b) => (a.followUpAt ?? '').localeCompare(b.followUpAt ?? '')).slice(0, 5);
  const dueCredentials = credentials.filter(c => c.changeDueAt).sort((a, b) => (a.changeDueAt ?? '').localeCompare(b.changeDueAt ?? ''));

  const cards = [
    { label: '최근 수정 자료', value: `${recentDocs.length}건`, to: '/support/knowledge' },
    { label: '미해결 장애·이슈', value: `${unresolvedIncidents.length}건`, to: '/support/ops' },
    { label: '진행 중 인수인계', value: `${activeHandovers.length}건`, to: '/support/ops' },
    { label: '변경 예정 계정', value: `${dueCredentials.length}건`, to: '/support/security' },
  ];

  return (
    <>
      <PageHeader title="업무지원센터" description="광고 성과·운영은 HOWTOM 유니버스가, 계약·정산·전자결재는 네이버 웍스가 담당합니다. 여기서는 지식·기록·인수인계·계정 보안을 관리합니다." />
      <div className="summary-grid summary-grid-compact">
        {cards.map(c => (
          <Link key={c.label} to={c.to} className="summary-card" style={{ textDecoration: 'none' }}>
            <div className="summary-card-label">{c.label}</div>
            <div className="summary-card-value">{c.value}</div>
          </Link>
        ))}
      </div>
      <div className="dashboard-bottom-grid">
        <section className="card"><div className="card-title-row"><div><h2 style={{ fontSize: 15 }}>후속 연락·조치 예정</h2></div></div>
          {upcomingFollowUps.length === 0 && <p className="muted" style={{ padding: 12 }}>예정된 후속 조치가 없습니다.</p>}
          <ul className="dashboard-action-list">{upcomingFollowUps.map(d => <li key={d.id}>{d.followUpAt} · {d.title}{d.advertiserName ? ` (${d.advertiserName})` : ''}</li>)}</ul>
        </section>
        <section className="card"><div className="card-title-row"><div><h2 style={{ fontSize: 15 }}>계정 보안 점검 예정</h2></div></div>
          {dueCredentials.length === 0 && <p className="muted" style={{ padding: 12 }}>예정된 변경이 없습니다.</p>}
          <ul className="dashboard-action-list">{dueCredentials.map(c => <li key={c.id}>{c.changeDueAt} · {c.serviceName}{c.advertiserName ? ` (${c.advertiserName})` : ''}</li>)}</ul>
        </section>
        <section className="card"><div className="card-title-row"><div><h2 style={{ fontSize: 15 }}>장기 미해결 이슈</h2></div></div>
          {unresolvedIncidents.length === 0 ? <div className="dashboard-empty"><ShieldCheck size={22} /><strong>미해결 이슈가 없습니다.</strong></div> : <ul className="dashboard-action-list">{unresolvedIncidents.map(d => <li key={d.id}>{d.title}</li>)}</ul>}
        </section>
        <section className="card"><div className="card-title-row"><div><h2 style={{ fontSize: 15 }}>진행 중 인수인계</h2></div></div>
          {activeHandovers.length === 0 ? <div className="dashboard-empty"><ShieldCheck size={22} /><strong>진행 중인 인수인계가 없습니다.</strong></div> : <ul className="dashboard-action-list">{activeHandovers.map(d => <li key={d.id}>{d.title}{d.owner ? ` · ${d.owner}` : ''}</li>)}</ul>}
        </section>
      </div>
    </>
  );
}
