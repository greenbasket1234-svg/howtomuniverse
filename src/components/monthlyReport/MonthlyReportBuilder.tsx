import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileText, RefreshCw, Download, Save, Trash2, Copy, FolderOpen, Plus, TrendingUp, X, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BASE_ADVERTISERS, REPORT_TYPE_LABEL, defaultProfileFor, loadExtraAdvertisers, loadProfiles, loadAllGeneratedReports, type ReportType, type GeneratedReport } from '../../features/reports/reportCore';
import { buildMonthlyReportData, generateMonthlyInsights, type MonthlyReportData } from '../../utils/monthlyReportData';
import { loadSavedMonthlyReports, saveMonthlyReport, deleteMonthlyReport, duplicateMonthlyReport, type SavedMonthlyReport } from '../../utils/monthlyReportStore';
import { loadBrandSettings, saveBrandSettings, type ReportBrandSettings } from '../../utils/reportBrandSettings';
import { CoverPage, KPIDashboardPage, HighlightPage, MediaPerformancePage, MediaComparisonPage, ChartsPage, MonthlyComparisonPage, BrandClosingPage } from './MonthlyReportPages';
import { buildNextMonthProposal, type NextMonthProposalData } from '../../utils/nextMonthProposal';
import { validateProposal } from '../../utils/proposalValidation';
import { loadSavedProposals, saveProposal, deleteProposal, type SavedProposal } from '../../utils/nextMonthProposalStore';
import { ProposalCoverPage, ProposalKpiPage, ProposalMediaRolesPage, ProposalMediaPages, ProposalNewPlatformPage, ProposalChartsPage, ProposalPerformanceChartPage, ProposalStrengthWeaknessPage, ProposalInsightPage, ProposalClosingPage } from './NextMonthProposalPages';
import { useAdvertiserFilter } from '../../context/AdvertiserFilterContext';
import { matchesAdvertiserFilter } from '../../utils/advertiserMatch';
import { generateSampleData, hasSampleData } from '../../utils/testSeed';

function compactInsightText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function monthlyPageTitle(el: HTMLElement, advertiserName: string, month: string, index: number) {
  if (el.id === 'mr-cover') return `${advertiserName} ${month} 월간 보고서 요약`;
  const bandTitle = el.querySelector<HTMLElement>(':scope > div:first-child strong')?.innerText?.trim();
  if (bandTitle) return bandTitle;
  const heading = el.querySelector<HTMLElement>('h1, h2, h3')?.innerText?.trim();
  return heading || `월간 보고서 ${index + 1}페이지`;
}

// jsPDF 기본 폰트는 한글을 안정적으로 그리지 못하므로, Insight 푸터를 브라우저 캔버스에서
// 먼저 이미지로 만든 뒤 PDF에 삽입합니다. 이 방식이면 사용자의 시스템 한글 폰트를 그대로
// 사용하면서 모든 실제 PDF 페이지(긴 표가 분할된 페이지 포함)에 푸터를 반복할 수 있습니다.
function createInsightFooterCanvas(title: string, text: string, pageNumber: number, totalPages: number, isSample: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 1800;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#dbe3ed';
  ctx.fillRect(0, 0, canvas.width, 3);
  ctx.fillStyle = '#27b4f2';
  ctx.fillRect(54, 25, 6, 61);

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111a2f';
  ctx.font = '700 25px sans-serif';
  ctx.fillText(title, 82, 42);
  if (isSample) {
    ctx.fillStyle = '#b45309';
    ctx.font = '700 17px sans-serif';
    ctx.fillText('TEST SAMPLE · 실제 운영 데이터 아님', 82, 76);
  }

  ctx.fillStyle = '#475569';
  ctx.font = '500 21px sans-serif';
  const startX = 430;
  const maxWidth = 1230;
  const lineHeight = 30;
  const words = compactInsightText(text).split('');
  const lines: string[] = [];
  let current = '';
  for (const char of words) {
    const candidate = current + char;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = char;
      if (lines.length === 2) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < 2 && current) lines.push(current);
  if (lines.length > 2) lines.length = 2;
  if (lines.length === 2 && words.join('').length > lines.join('').length) {
    let last = lines[1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[1] = `${last}…`;
  }
  lines.forEach((line, index) => ctx.fillText(line, startX, 38 + index * lineHeight));

  ctx.fillStyle = '#64748b';
  ctx.font = '600 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${pageNumber} / ${totalPages}`, 1740, 88);
  ctx.textAlign = 'left';
  return canvas;
}

export function MonthlyReportBuilder({ focusMode = 'both' }: { focusMode?: 'report' | 'proposal' | 'both' } = {}) {
  const allAdvertisers = Array.from(new Set([...BASE_ADVERTISERS, ...loadExtraAdvertisers()]));
  const { filterValue } = useAdvertiserFilter();
  const [advertiserName, setAdvertiserName] = useState(allAdvertisers[0] ?? '');
  const [reportType, setReportType] = useState<ReportType>(() => (loadProfiles()[allAdvertisers[0] ?? ''] ?? defaultProfileFor(allAdvertisers[0] ?? '')).reportType);
  const [sampleExists, setSampleExists] = useState(() => hasSampleData());
  const [sampleGenerating, setSampleGenerating] = useState(false);
  // 상단 헤더에서 광고주를 검색·선택하면(filterValue), 정확히 한 명만 매칭될 때 이 화면의
  // 대상 광고주도 함께 전환합니다. 보고서 관리 화면과 같은 원칙입니다.
  useEffect(() => {
    if (!filterValue.trim()) return;
    const matches = allAdvertisers.filter(name => matchesAdvertiserFilter(name, filterValue));
    if (matches.length === 1 && matches[0] !== advertiserName) setAdvertiserName(matches[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValue]);
  useEffect(() => {
    if (!advertiserName) return;
    const stored = loadProfiles()[advertiserName] ?? defaultProfileFor(advertiserName);
    setReportType(stored.reportType);
  }, [advertiserName]);
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [data, setData] = useState<MonthlyReportData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [proposal, setProposal] = useState<NextMonthProposalData | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [proposalInsights, setProposalInsights] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'report' | 'proposal'>(focusMode === 'proposal' ? 'proposal' : 'report');
  const [pdfStatus, setPdfStatus] = useState('');
  const handleGenerateSample = () => {
    setSampleGenerating(true);
    const result = generateSampleData();
    setSampleGenerating(false);
    setSampleExists(hasSampleData());
    setPdfStatus(result.ok ? `샘플 데이터를 만들었습니다(${result.count}건). 광고주·월을 고른 뒤 "월간 보고서 생성"을 다시 눌러보세요.` : `오류: ${result.error ?? '샘플 데이터를 만들지 못했습니다.'}`);
    setTimeout(() => setPdfStatus(''), 5000);
  };
  const [saving, setSaving] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [savedList, setSavedList] = useState<SavedMonthlyReport[]>(() => loadSavedMonthlyReports());
  const [savedProposalId, setSavedProposalId] = useState<string | null>(null);
  const [showProposalList, setShowProposalList] = useState(false);
  const [savedProposalList, setSavedProposalList] = useState<SavedProposal[]>(() => loadSavedProposals());
  // "보고서 관리"에서 저장한 원본 보고서(GeneratedReport)를 이 화면에서도 확인할 수 있도록,
  // 지금 고른 광고주·월에 해당하는 것만 모읍니다. 월간 보고서를 만들 때 이 원본이 실제로
  // 사용되므로, 여기 개수가 0이면 "월간 보고서 생성"을 눌러도 데모로 채워질 수 있습니다.
  const linkedGeneratedReports = useMemo(
    () => loadAllGeneratedReports().filter(r => r.advertiserName === advertiserName && r.month === month && r.rows?.length),
    [advertiserName, month],
  );
  const [showLinkedReports, setShowLinkedReports] = useState(false);
  const saveProposalToList = () => {
    if (!proposal) return;
    const errors = validateProposal(proposal).filter(issue => issue.level === 'error');
    if (errors.length > 0) {
      setShowValidation(true);
      setPdfStatus('숫자 오류가 발견되어 저장을 중단했습니다. "보고서 최종 검증" 내용을 확인해 주세요.');
      setTimeout(() => setPdfStatus(''), 4200);
      return;
    }
    const saved = saveProposal(savedProposalId, proposal.advertiserName, proposal.sourceMonth, proposal.targetMonth, proposal, proposalInsights, Boolean(proposal.isSample));
    if (!saved) { setPdfStatus('브라우저 저장 공간이 부족해 제안서를 저장하지 못했습니다.'); setTimeout(() => setPdfStatus(''), 3200); return; }
    setSavedProposalId(saved.id);
    setSavedProposalList(loadSavedProposals());
    setPdfStatus('다음달 제안서를 저장했습니다.');
    setTimeout(() => setPdfStatus(''), 3200);
  };
  const openSavedProposal = (item: SavedProposal) => {
    setAdvertiserName(item.advertiserName);
    setProposal(item.data);
    setProposalInsights(item.proposals);
    setSavedProposalId(item.id);
    setViewMode('proposal');
    setShowProposalList(false);
  };
  const [brand, setBrand] = useState<ReportBrandSettings>(() => loadBrandSettings(allAdvertisers[0] ?? ''));
  const [showBrand, setShowBrand] = useState(false);
  const pagesRef = useRef<HTMLDivElement>(null);
  const proposalPagesRef = useRef<HTMLDivElement>(null);

  const generate = () => {
    if (!advertiserName.trim()) return;
    const profiles = loadProfiles();
    const result = buildMonthlyReportData(advertiserName.trim(), month, profiles, reportType);
    setData(result);
    setBrand(loadBrandSettings(advertiserName.trim()));
    // '데이터 불러오기'는 항상 새 보고서로 시작합니다. 같은 광고주·월로 저장된 보고서가 있어도
    // 자동으로 그 보고서를 수정하는 상태가 되지 않습니다 — 그러면 사용자가 새로 만든다고
    // 생각한 채로 '저장'을 눌렀을 때 기존 저장본이 조용히 덮어써질 수 있기 때문입니다.
    // 기존 보고서를 고치고 싶다면 아래 "저장된 보고서" 목록에서 '열기'를 눌러야 합니다.
    setInsights(generateMonthlyInsights(result));
    setSavedReportId(null);
    setProposal(null);
    setViewMode('report');
  };

  const saveReport = () => {
    if (!data) return;
    if (data.isSample && !window.confirm('테스트 샘플 월간 보고서입니다. 실제 보고서와 분리된 샘플 저장소에 저장됩니다. 계속하시겠습니까?')) return;
    if (data.currentOrigin === 'demo') {
      setPdfStatus('이번 달 실제 데이터가 없어 보고서를 저장할 수 없습니다. 왼쪽 메뉴의 "보고서 관리"에서 데이터를 저장한 뒤 다시 만들어 주세요. (테스트로 먼저 확인하려면 위의 "5·6·7월 샘플 데이터 만들기"를 눌러보세요.)');
      setTimeout(() => setPdfStatus(''), 4200);
      return;
    }
    const saved = saveMonthlyReport(savedReportId, data.advertiserName, data.month, data, insights, brand);
    if (!saved) {
      setPdfStatus('브라우저 저장 공간이 부족해 보고서를 저장하지 못했습니다. 오래된 저장 보고서를 삭제한 뒤 다시 시도해 주세요.');
      setTimeout(() => setPdfStatus(''), 4200);
      return;
    }
    setSavedReportId(saved.id);
    setSavedList(loadSavedMonthlyReports());
    setPdfStatus(data.isSample ? '테스트 샘플 월간 보고서를 샘플 저장소에 저장했습니다.' : '월간 보고서를 저장했습니다.');
    setTimeout(() => setPdfStatus(''), 2200);
  };

  const openSaved = (report: SavedMonthlyReport) => {
    setAdvertiserName(report.advertiserName);
    setMonth(report.month);
    setReportType(report.data.reportType);
    // 저장 당시의 데이터·브랜드 설정을 그대로 복원합니다. 원본 광고 데이터가 그 뒤에 바뀌었어도
    // 이 보고서를 다시 열면 저장했던 숫자가 그대로 나옵니다(다시 계산하지 않습니다).
    // 로고만 예외로, 스냅샷에는 담겨 있지 않아서(중복 저장 방지) 이 광고주의 현재 브랜드
    // 설정에서 최신 로고를 가져와 합칩니다.
    setData(report.data);
    setInsights(report.insights);
    setBrand({ ...loadBrandSettings(report.advertiserName), ...report.brand });
    setSavedReportId(report.id);
    setShowList(false);
  };

  const removeSaved = (id: string) => {
    const target = savedList.find(report => report.id === id);
    if (!window.confirm(target?.isSample || target?.data.isSample ? '이 테스트 샘플 월간 보고서를 삭제할까요?' : '이 저장된 월간 보고서를 삭제할까요?')) return;
    deleteMonthlyReport(id);
    setSavedList(loadSavedMonthlyReports());
    if (savedReportId === id) setSavedReportId(null);
  };

  const copySaved = (id: string) => {
    const copy = duplicateMonthlyReport(id);
    if (copy) setSavedList(loadSavedMonthlyReports());
  };

  const updateInsight = (index: number, value: string) => {
    setInsights(prev => prev.map((line, i) => i === index ? value : line));
  };
  const removeInsight = (index: number) => {
    setInsights(prev => prev.filter((_, i) => i !== index));
  };
  const addInsight = () => {
    setInsights(prev => [...prev, '새 인사이트를 입력하세요.']);
  };
  const regenerateInsights = () => {
    if (!data) return;
    setInsights(generateMonthlyInsights(data));
  };

  const generateProposal = () => {
    if (!advertiserName.trim()) return;
    const base = data && data.advertiserName === advertiserName.trim() && data.month === month && data.reportType === reportType
      ? data
      : buildMonthlyReportData(advertiserName.trim(), month, loadProfiles(), reportType);
    if (base.currentOrigin === 'demo') {
      setPdfStatus('월간 실제 데이터가 없어 다음달 제안서를 만들 수 없습니다. 먼저 월간 보고서를 생성해 주세요.');
      setTimeout(() => setPdfStatus(''), 4200);
      return;
    }
    setData(base);
    const nextProposal = buildNextMonthProposal(base);
    setProposal(nextProposal);
    setProposalInsights(nextProposal.proposals);
    setViewMode('proposal');
    const saved = saveProposal(null, nextProposal.advertiserName, nextProposal.sourceMonth, nextProposal.targetMonth, nextProposal, nextProposal.proposals, Boolean(nextProposal.isSample));
    if (saved) {
      setSavedProposalId(saved.id);
      setSavedProposalList(loadSavedProposals());
      setPdfStatus('다음달 제안서를 생성하고 저장된 다음달 제안서에 저장했습니다.');
      setTimeout(() => setPdfStatus(''), 3200);
    } else {
      setSavedProposalId(null);
      setPdfStatus('제안서는 생성했지만 브라우저 저장 공간이 부족해 저장하지 못했습니다.');
      setTimeout(() => setPdfStatus(''), 4200);
    }
  };

  const updateProposalInsight = (index: number, value: string) => setProposalInsights(prev => prev.map((line, i) => i === index ? value : line));
  const regenerateProposalInsights = () => {
    if (!proposal) return;
    const next = buildNextMonthProposal(data!);
    setProposal(next);
    setProposalInsights(next.proposals);
  };

  const saveBrand = () => {
    if (!data) return;
    const ok = saveBrandSettings(data.advertiserName, brand);
    setPdfStatus(ok ? '브랜드 설정을 저장했습니다.' : '브라우저 저장 공간이 부족해 브랜드 설정을 저장하지 못했습니다.');
    setTimeout(() => setPdfStatus(''), ok ? 2000 : 3600);
  };

  const savePagesPdf = async ({
    container,
    filename,
    footerTitle,
    footerTexts,
    isSample,
    titleMonth,
  }: {
    container: HTMLDivElement | null;
    filename: string;
    footerTitle: string;
    footerTexts: string[];
    isSample: boolean;
    titleMonth: string;
  }) => {
    if (!container || saving) return;
    setSaving(true);
    if (isSample && !window.confirm('테스트 샘플 데이터 PDF입니다. 실제 광고주에게 전달하면 안 됩니다. 그래도 저장하시겠습니까?')) { setSaving(false); return; }
    try {
      setPdfStatus('PDF를 생성하는 중입니다...');
      // 저장된 보고서를 연 직후 곧바로 PDF 버튼을 누르면, 화면이 다 그려지기 전에 캡처가
      // 시작될 수 있습니다. 브라우저가 최소 한 번의 페인트를 마칠 때까지 기다립니다.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if ('fonts' in document) { try { await document.fonts.ready; } catch { /* ignore */ } }
      const pageEls = Array.from(container.querySelectorAll<HTMLElement>('.monthly-report-page'));
      if (pageEls.length === 0) throw new Error('생성할 페이지가 없습니다.');
      const pageFooterTexts = pageEls.map((el, index) => {
        const title = monthlyPageTitle(el, advertiserName, titleMonth, index);
        const edited = footerTexts.length > 0 ? footerTexts[index % footerTexts.length] : `${title}의 핵심 운영 포인트를 확인해 주세요.`;
        return `${title} · ${compactInsightText(edited)}`;
      });
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const footerHeight = 17;
      const contentHeight = pageHeight - footerHeight;
      const contentWidth = pageWidth * (contentHeight / pageHeight);
      const contentX = (pageWidth - contentWidth) / 2;
      const captured: HTMLCanvasElement[] = [];
      const blankPageNumbers: number[] = [];
      const rowBoundaries: number[][] = [];
      // 저장된 월간 보고서를 열자마자 곧바로 PDF 버튼을 누르면, 화면 렌더링이 다 끝나기 전에
      // 캡처가 시작돼 빈(흰색뿐인) 페이지가 그대로 PDF에 들어갈 수 있습니다. 캡처 직후 실제로
      // 내용이 그려졌는지 확인하고, 비어 있으면 잠깐 기다렸다 한 번 더 캡처합니다.
      const isCanvasBlank = (c: HTMLCanvasElement) => {
        const ctx = c.getContext('2d');
        if (!ctx || c.width === 0 || c.height === 0) return true;
        const sample = document.createElement('canvas');
        sample.width = 64; sample.height = 64;
        const sampleCtx = sample.getContext('2d');
        if (!sampleCtx) return false;
        sampleCtx.drawImage(c, 0, 0, 64, 64);
        const { data } = sampleCtx.getImageData(0, 0, 64, 64);
        let colored = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248) {
            colored += 1;
            if (colored > 8) return false;
          }
        }
        return true;
      };
      for (const el of pageEls) {
        const scale = 1.45;
        const rect = el.getBoundingClientRect();
        rowBoundaries.push(Array.from(el.querySelectorAll('tbody tr')).map(tr => Math.round((tr.getBoundingClientRect().bottom - rect.top) * scale)));
        const capture = async (hideImages = false) => {
          const logos = hideImages ? Array.from(el.querySelectorAll<HTMLImageElement>('img')) : [];
          logos.forEach(img => { img.dataset.hiddenForPdf = img.style.display; img.style.display = 'none'; });
          try {
            return await html2canvas(el, { scale, backgroundColor: '#ffffff', useCORS: !hideImages, imageTimeout: 12000, logging: false, scrollX: 0, scrollY: 0 });
          } finally {
            logos.forEach(img => { img.style.display = img.dataset.hiddenForPdf ?? ''; });
          }
        };
        let finalCanvas: HTMLCanvasElement;
        try { finalCanvas = await capture(false); }
        catch { finalCanvas = await capture(true); }
        if (isCanvasBlank(finalCanvas)) {
          await new Promise(resolve => setTimeout(resolve, 250));
          try { finalCanvas = await capture(false); }
          catch { finalCanvas = await capture(true); }
        }
        if (isCanvasBlank(finalCanvas)) blankPageNumbers.push(captured.length + 1);
        captured.push(finalCanvas);
      }
      if (blankPageNumbers.length > 0) {
        throw new Error(`${blankPageNumbers.join(', ')}페이지를 캡처하지 못했습니다(빈 화면). 잠시 후 다시 시도해 주세요.`);
      }
      if (captured.every(isCanvasBlank)) {
        throw new Error('보고서 화면을 캡처하지 못했습니다(빈 화면). 잠시 후 다시 시도해 주세요.');
      }
      const pxPerMm = captured[0] ? captured[0].width / contentWidth : 1;
      const pageHeightPx = Math.round(contentHeight * pxPerMm);
      // 브라우저마다 폰트 렌더링·스크롤바 유무 등으로 실제 콘텐츠 높이가 1~2px 안팎으로
      // 들쭉날쭉할 수 있습니다. 이 정도의 미세한 초과분 때문에 거의 빈 페이지가 하나 더
      // 생기지 않도록, 페이지 높이 대비 3% 이내의 여분은 같은 페이지 안에 그대로 담습니다.
      const tinyRemainderPx = Math.max(6, Math.round(pageHeightPx * 0.03));
      const computeSlices = (height: number, boundaries: number[]) => {
        const slices: number[] = []; let consumed = 0;
        while (consumed < height) {
          const remaining = height - consumed; const maxEnd = consumed + pageHeightPx;
          let slice = Math.min(pageHeightPx, remaining);
          if (remaining > pageHeightPx && boundaries.length) {
            const candidates = boundaries.filter(value => value > consumed && value <= maxEnd);
            if (candidates.length) slice = candidates[candidates.length - 1] - consumed;
          }
          if (slice <= 0) slice = Math.min(pageHeightPx, remaining);
          // 이 슬라이스를 넣고 남는 나머지가 아주 작다면(공백에 가까운 한 페이지가 될
          // 정도라면), 별도 페이지를 만들지 않고 이번 슬라이스에 합쳐서 마저 담습니다.
          if (height - (consumed + slice) > 0 && height - (consumed + slice) <= tinyRemainderPx) {
            slice = height - consumed;
          }
          slices.push(slice); consumed += slice;
        }
        return slices.length ? slices : [height];
      };
      const sliceCounts = captured.map((canvas, index) => (canvas.height / canvas.width) * contentWidth <= contentHeight + 3 ? 1 : computeSlices(canvas.height, rowBoundaries[index]).length);
      const totalPages = sliceCounts.reduce((total, count) => total + count, 0);
      const drawFooter = (sourceIndex: number, sliceIndex: number, sliceTotal: number, pageNumber: number) => {
        const continuation = sliceTotal > 1 ? ` · 세부 ${sliceIndex + 1}/${sliceTotal}` : '';
        const footer = createInsightFooterCanvas(footerTitle, `${pageFooterTexts[sourceIndex]}${continuation}`, pageNumber, totalPages, isSample);
        doc.addImage(footer.toDataURL('image/jpeg', .95), 'JPEG', 0, contentHeight, pageWidth, footerHeight);
      };
      let pageIndex = 0;
      captured.forEach((canvas, sourceIndex) => {
        const imgHeight = canvas.height / canvas.width * contentWidth;
        if (imgHeight <= contentHeight + 3) {
          if (pageIndex > 0) doc.addPage();
          doc.addImage(canvas.toDataURL('image/jpeg', .92), 'JPEG', contentX, 0, contentWidth, Math.min(imgHeight, contentHeight), undefined, 'FAST');
          pageIndex += 1; drawFooter(sourceIndex, 0, 1, pageIndex);
          return;
        }
        let consumed = 0; const slices = computeSlices(canvas.height, rowBoundaries[sourceIndex]);
        slices.forEach((sliceHeight, sliceIndex) => {
          if (pageIndex > 0) doc.addPage();
          const sliceCanvas = document.createElement('canvas'); sliceCanvas.width = canvas.width; sliceCanvas.height = sliceHeight;
          sliceCanvas.getContext('2d')?.drawImage(canvas, 0, consumed, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
          doc.addImage(sliceCanvas.toDataURL('image/jpeg', .92), 'JPEG', contentX, 0, contentWidth, Math.min(sliceHeight / canvas.width * contentWidth, contentHeight), undefined, 'FAST');
          consumed += sliceHeight; pageIndex += 1; drawFooter(sourceIndex, sliceIndex, slices.length, pageIndex);
        });
      });
      const blob = doc.output('blob');
      if (blob.size < 1000) throw new Error('PDF 내용 생성에 실패했습니다.');
      const headerBytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
      if (String.fromCharCode(...headerBytes) !== '%PDF-') throw new Error('생성된 PDF 파일 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      // 다운로드가 실제로 시작되기 전에 Object URL이 해제되는 브라우저가 있어 충분히 늦게 정리합니다.
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setPdfStatus('PDF 파일로 저장했습니다.');
    } catch (error) {
      setPdfStatus(`PDF 생성 중 문제가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setSaving(false); setTimeout(() => setPdfStatus(''), 3200);
    }
  };

  const savePdf = async () => {
    if (!data || !pagesRef.current) return;
    if (data.currentOrigin === 'demo') { setPdfStatus('이번 달 실제 데이터가 없어 PDF를 저장할 수 없습니다.'); setTimeout(() => setPdfStatus(''), 4200); return; }
    if (data.previousOrigin === 'demo' && !window.confirm('전월 데이터가 없어 증감 비교가 제외된 상태입니다. 그래도 PDF를 저장하시겠습니까?')) return;
    await savePagesPdf({ container: pagesRef.current, filename: `${data.isSample ? '[샘플]_' : ''}${data.advertiserName}_${data.month}_월간보고서.pdf`, footerTitle: '퍼포먼스 마케터 Insight', footerTexts: insights, isSample: Boolean(data.isSample), titleMonth: data.month });
  };

  const saveProposalPdf = async () => {
    if (!proposal || !proposalPagesRef.current) return;
    // 저장 직전에 자동으로 최종 검증을 실행합니다. 심각한 오류(숫자 불일치 등)가 있으면
    // 저장을 진행하지 않고 검증 결과 창을 띄워서, 사용자가 "최종 검증" 버튼을 따로
    // 누르지 않아도 잘못된 숫자가 그대로 PDF로 나가는 것을 막습니다.
    const errors = validateProposal(proposal).filter(issue => issue.level === 'error');
    if (errors.length > 0) {
      setShowValidation(true);
      setPdfStatus('숫자 오류가 발견되어 저장을 중단했습니다. "보고서 최종 검증" 내용을 확인해 주세요.');
      setTimeout(() => setPdfStatus(''), 4200);
      return;
    }
    await savePagesPdf({ container: proposalPagesRef.current, filename: `${proposal.isSample ? '[샘플]_' : ''}${proposal.advertiserName}_${proposal.targetMonth}_다음달_제안서.pdf`, footerTitle: '퍼포먼스 마케터 다음달 제안', footerTexts: proposalInsights, isSample: Boolean(proposal.isSample), titleMonth: proposal.targetMonth });
  };

  return (
    <section className="card">
      <div className="daily-report-section-head">
        <div><h3>{focusMode === 'proposal' ? '다음달 제안서 만들기' : focusMode === 'report' ? '월간 광고분석 보고서 만들기' : '월간 보고서 만들기'}</h3><p>{focusMode === 'proposal' ? '광고주와 기준이 될 월(이번 달 실적)을 고르면, 그 실적을 토대로 다음달 예산 제안·매체별 KPI·강점과 보완점·인사이트가 담긴 다음달 제안서를 자동으로 만듭니다. PDF에는 모든 장 하단에 페이지별 다음달 제안이 들어갑니다.' : focusMode === 'report' ? '광고주와 보고 월을 고르면 저장된 실제 데이터로 전월 대비 KPI·매체별 성과표·차트·인사이트가 담긴 월간 광고분석 보고서를 자동으로 만듭니다. PDF에는 모든 장 하단에 페이지별 퍼포먼스 마케터 Insight가 들어갑니다.' : '광고주와 보고 월을 고르면 저장된 실제 데이터로 월간 성과 보고서를 만들고, 그 결과를 토대로 다음달 KPI·매체별 기대 성과·예산 운영안·차트·인사이트가 포함된 다음달 제안서까지 자동으로 생성합니다. 두 PDF 모두 모든 장 하단에 페이지별 퍼포먼스 마케터 Insight 또는 다음달 제안이 들어갑니다.'}</p></div>
      </div>
      {focusMode !== 'both' && <div className="channel-switch-tabs" style={{ marginBottom: 14 }}><Link to="/monthly-reports" className={focusMode === 'report' ? 'active' : ''}>월간 보고서</Link><Link to="/next-month-proposal" className={focusMode === 'proposal' ? 'active' : ''}>다음달 제안서</Link></div>}
      {!sampleExists && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>ℹ 아직 저장된 실제 데이터가 없습니다. "월간 보고서 생성"을 눌렀을 때 "저장된 데이터가 없습니다"라고 나오면, 광고주 12곳에 5·6·7월 테스트 샘플 데이터를 바로 만들어서 기능을 먼저 확인해 볼 수 있습니다.</span>
          <button type="button" className="btn primary sm" onClick={handleGenerateSample} disabled={sampleGenerating}>{sampleGenerating ? '만드는 중...' : '5·6·7월 샘플 데이터 만들기'}</button>
        </div>
      )}
      <div className="form-grid">
        <label className="field-label">광고주
          <input value={advertiserName} onChange={e => setAdvertiserName(e.target.value)} list="monthly-report-advertisers" />
          <datalist id="monthly-report-advertisers">{allAdvertisers.map(name => <option key={name} value={name} />)}</datalist>
        </label>
        <label className="field-label">보고서 유형
          <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)}>
            {(Object.keys(REPORT_TYPE_LABEL) as ReportType[]).map(type => <option key={type} value={type}>{REPORT_TYPE_LABEL[type]}</option>)}
          </select>
        </label>
        <label className="field-label">보고 연월<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
      </div>
      <div style={{ fontSize: 12.5, color: linkedGeneratedReports.length ? '#166534' : '#94a3b8', marginBottom: 10 }}>
        {linkedGeneratedReports.length > 0 ? (
          <>✓ "보고서 관리"에 저장된 {advertiserName} {month} 원본 보고서 {linkedGeneratedReports.length}건이 연동되어 있습니다. <button type="button" onClick={() => setShowLinkedReports(v => !v)} style={{ background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5 }}>{showLinkedReports ? '접기' : '목록 보기'}</button></>
        ) : (
          <>ℹ "보고서 관리"에 저장된 {advertiserName} {month} 원본 보고서가 아직 없습니다 — 왼쪽 메뉴의 "보고서 관리"에서 먼저 데이터를 저장해 주세요.</>
        )}
      </div>
      {showLinkedReports && linkedGeneratedReports.length > 0 && (
        <div style={{ marginBottom: 14, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {linkedGeneratedReports.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}>
              <span><b>{r.reportName || r.periodLabel || r.month}</b><span style={{ marginLeft: 8, color: '#64748b' }}>{REPORT_TYPE_LABEL[r.reportType]} · {r.rowCount}개 행 · {new Date(r.createdAt).toLocaleString('ko-KR')}</span></span>
            </div>
          ))}
        </div>
      )}
      <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={generate}><RefreshCw size={15} /> 월간 보고서 생성</button>
        {data && <button className="btn primary" onClick={generateProposal}><TrendingUp size={15} /> 다음달 제안서 만들기</button>}
        {data && <button className="btn secondary" onClick={saveReport}><Save size={15} /> {savedReportId ? '수정 저장' : '보고서 저장'}</button>}
        <button className="btn secondary" onClick={() => { setSavedList(loadSavedMonthlyReports()); setShowList(v => !v); }}><FolderOpen size={15} /> 저장된 월간 보고서 ({savedList.length})</button>
        {data && <button className="btn secondary" onClick={() => setShowBrand(v => !v)}>표지 · 브랜드 설정</button>}
        {data && viewMode === 'report' && <button className="btn secondary" onClick={savePdf} disabled={saving}><Download size={15} /> {saving ? 'PDF 생성 중...' : '월간 보고서 PDF 저장'}</button>}
        {proposal && viewMode === 'proposal' && <button className="btn secondary" onClick={saveProposalPdf} disabled={saving}><Download size={15} /> {saving ? 'PDF 생성 중...' : '다음달 제안서 PDF 저장'}</button>}
        {proposal && viewMode === 'proposal' && <button className="btn secondary" onClick={() => setShowValidation(true)}><ShieldCheck size={15} /> 보고서 최종 검증</button>}
        {proposal && viewMode === 'proposal' && <button className="btn secondary" onClick={saveProposalToList}><Save size={15} /> 제안서 저장</button>}
        <button className="btn secondary" onClick={() => { setSavedProposalList(loadSavedProposals()); setShowProposalList(v => !v); }}><FolderOpen size={15} /> 저장된 다음달 제안서 ({savedProposalList.length})</button>
      </div>
      {pdfStatus && <div className="daily-report-notice"><FileText size={16} />{pdfStatus}</div>}

      {showValidation && proposal && (() => {
        const issues = validateProposal(proposal);
        const errors = issues.filter(i => i.level === 'error');
        const warnings = issues.filter(i => i.level === 'warning');
        return (
          <div className="modal-backdrop" onClick={() => setShowValidation(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
              <div className="modal-head">
                <div><h3>보고서 최종 검증</h3><p>숫자 일관성과 데이터 상태를 자동으로 점검한 결과입니다. PDF로 저장하기 전에 확인하세요.</p></div>
                <button className="icon-btn" onClick={() => setShowValidation(false)}><X size={18} /></button>
              </div>
              {issues.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 4px', color: '#15803d' }}><CheckCircle2 size={22} /><span>문제가 발견되지 않았습니다. 저장해도 안전합니다.</span></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  {errors.map((issue, index) => (
                    <div key={`e${index}`} style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5, color: '#991b1b' }}><AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /><span>{issue.message}</span></div>
                  ))}
                  {warnings.map((issue, index) => (
                    <div key={`w${index}`} style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12.5, color: '#92400e' }}><AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /><span>{issue.message}</span></div>
                  ))}
                </div>
              )}
              <div className="modal-actions"><button className="btn secondary" onClick={() => setShowValidation(false)}>닫기</button></div>
            </div>
          </div>
        );
      })()}
      {showBrand && data && (
        <div style={{ marginTop: 14, border: '1px solid #eef1f5', borderRadius: 10, padding: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>표지 · 브랜드 설정 ({data.advertiserName})</h4>
          <div className="form-grid">
            <label className="field-label">로고 이미지
              <input value={brand.logoUrl} onChange={e => setBrand({ ...brand, logoUrl: e.target.value })} placeholder="https://... 또는 아래에서 파일 선택" />
              <input type="file" accept="image/*" style={{ marginTop: 6, fontSize: 12 }} onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 8 * 1024 * 1024) { setPdfStatus('이미지 용량이 너무 큽니다(8MB 이하로 선택해 주세요).'); setTimeout(() => setPdfStatus(''), 3000); return; }
                // 로컬 파일을 Data URL로 바꿔서 저장합니다. 외부 URL과 달리 CORS 문제 없이
                // PDF 캡처에 항상 안정적으로 들어갑니다. 원본을 그대로 저장하면 localStorage(브라우저
                // 저장 공간)를 많이 차지하고 모든 월간 보고서 스냅샷에마다 중복 저장되므로,
                // 표지에 필요한 크기(최대 240px 높이)로 줄이고 JPEG로 압축해서 저장합니다.
                const reader = new FileReader();
                reader.onload = () => {
                  const img = new Image();
                  img.onload = () => {
                    const maxHeight = 240;
                    const scale = Math.min(1, maxHeight / img.height);
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.85);
                    setBrand(b => ({ ...b, logoUrl: compressed }));
                  };
                  img.src = String(reader.result);
                };
                reader.readAsDataURL(file);
              }} />
              <small style={{ color: '#94a3b8', fontSize: 11 }}>파일을 선택하면 URL 입력은 무시되고, PDF에도 항상 안정적으로 표시됩니다.</small>
            </label>
            <label className="field-label">대표 색상<input type="color" value={brand.brandColor} onChange={e => setBrand({ ...brand, brandColor: e.target.value })} style={{ height: 36 }} /></label>
            <label className="field-label">회사명(대행사)<input value={brand.companyName} onChange={e => setBrand({ ...brand, companyName: e.target.value })} /></label>
            <label className="field-label">담당자명<input value={brand.managerName} onChange={e => setBrand({ ...brand, managerName: e.target.value })} /></label>
          </div>
          <label className="field-label">표지 문구<input value={brand.coverMessage} onChange={e => setBrand({ ...brand, coverMessage: e.target.value })} placeholder="예: 이번 달도 좋은 성과로 함께했습니다" /></label>
          <button className="btn secondary sm" style={{ marginTop: 8 }} onClick={saveBrand}><Save size={13} /> 이 광고주의 브랜드 설정 저장</button>
        </div>
      )}

      {showList && (
        <div style={{ marginTop: 14, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {savedList.length === 0 && <p className="muted" style={{ padding: 16 }}>저장된 월간 보고서가 없습니다.</p>}
          {savedList.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <b style={{ fontSize: 13 }}>{r.label}</b>
                {(r.isSample || r.data.isSample) && <span style={{ marginLeft: 6, display: 'inline-flex', padding: '2px 7px', borderRadius: 999, background: '#fff7ed', color: '#c2410c', fontSize: 10.5, fontWeight: 800 }}>테스트 샘플본</span>}
                <span style={{ marginLeft: 6, fontSize: 12, color: '#64748b' }}>{r.month} · 수정 {new Date(r.updatedAt).toLocaleDateString('ko-KR')}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn secondary sm" onClick={() => openSaved(r)}>열기</button>
                <button className="icon-btn" title="복제" onClick={() => copySaved(r.id)}><Copy size={15} /></button>
                <button className="icon-btn danger" title="삭제" onClick={() => removeSaved(r.id)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showProposalList && (
        <div style={{ marginTop: 14, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {savedProposalList.length === 0 && <p className="muted" style={{ padding: 16 }}>저장된 다음달 제안서가 없습니다.</p>}
          {savedProposalList.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <b style={{ fontSize: 13 }}>{item.label}</b>
                {item.isSample && <span style={{ marginLeft: 6, display: 'inline-flex', padding: '2px 7px', borderRadius: 999, background: '#fff7ed', color: '#c2410c', fontSize: 10.5, fontWeight: 800 }}>테스트 샘플본</span>}
                <span style={{ marginLeft: 6, fontSize: 12, color: '#64748b' }}>{item.sourceMonth} 실적 기반 · {item.targetMonth} 제안 · 수정 {new Date(item.updatedAt).toLocaleDateString('ko-KR')}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn secondary sm" onClick={() => openSavedProposal(item)}>열기</button>
                <button className="icon-btn danger" title="삭제" onClick={() => { if (window.confirm('이 저장된 다음달 제안서를 삭제할까요?')) { deleteProposal(item.id); setSavedProposalList(loadSavedProposals()); } }}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(data || proposal) && <div className="monthly-builder-mode-tabs">
        {data && <button className={viewMode === 'report' ? 'active' : ''} onClick={() => setViewMode('report')}><FileText size={14}/> 월간 보고서</button>}
        {proposal && <button className={viewMode === 'proposal' ? 'active' : ''} onClick={() => setViewMode('proposal')}><TrendingUp size={14}/> 다음달 제안서</button>}
      </div>}

      {data && viewMode === 'report' && (
        <>
          <div style={{ marginTop: 20, border: '1px solid #eef1f5', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>퍼포먼스 마케터 Insight 편집</h4>
              <button className="btn secondary sm" onClick={regenerateInsights}><RefreshCw size={13} /> 자동 문구 다시 생성</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <textarea value={line} onChange={e => updateInsight(i, e.target.value)} rows={2} style={{ flex: 1, fontSize: 12.5, padding: '8px 10px', border: '1px solid #dfe4ec', borderRadius: 8, resize: 'vertical' }} />
                  <button className="icon-btn danger" title="삭제" onClick={() => removeInsight(i)}><X size={15} /></button>
                </div>
              ))}
            </div>
            <button className="btn secondary sm" style={{ marginTop: 8 }} onClick={addInsight}><Plus size={13} /> 인사이트 추가</button>
            <p className="footnote" style={{ marginTop: 8 }}>여기서 수정한 문구가 아래 미리보기와 PDF에 그대로 반영됩니다. "보고서 저장"을 눌러야 다음에 다시 열었을 때도 유지됩니다.</p>
          </div>

          <div ref={pagesRef} className="monthly-pages-preview">
            <CoverPage data={data} brand={brand} />
            <HighlightPage data={data} />
            <KPIDashboardPage data={data} />
            <MediaPerformancePage data={data} />
            <MediaComparisonPage data={data} />
            <ChartsPage data={data} />
            <MonthlyComparisonPage data={data} insights={insights} />
            <BrandClosingPage accent={brand.brandColor}/>
          </div>
        </>
      )}

      {proposal && viewMode === 'proposal' && (
        <>
          <div className="proposal-insight-editor">
            <div className="proposal-insight-head"><div><h4>퍼포먼스 마케터 다음달 제안 편집</h4><p>각 문구는 제안서 PDF의 페이지별 하단 제안 영역에 자동으로 반복 배치됩니다.</p></div><button className="btn secondary sm" onClick={regenerateProposalInsights}><RefreshCw size={13}/> 자동 제안 다시 생성</button></div>
            {proposalInsights.map((line, index) => <div className="proposal-insight-row" key={index}><textarea rows={2} value={line} onChange={event => updateProposalInsight(index, event.target.value)}/></div>)}
          </div>
          <div ref={proposalPagesRef} className="monthly-pages-preview">
            <ProposalCoverPage data={proposal}/>
            <ProposalKpiPage data={proposal}/>
            <ProposalMediaRolesPage data={proposal}/>
            <ProposalMediaPages data={proposal}/>
            <ProposalNewPlatformPage data={proposal}/>
            <ProposalChartsPage data={proposal}/>
            <ProposalPerformanceChartPage data={proposal}/>
            <ProposalStrengthWeaknessPage data={proposal}/>
            <ProposalInsightPage data={proposal} proposals={proposalInsights}/>
            <ProposalClosingPage/>
          </div>
        </>
      )}
    </section>
  );
}
