import { CREATIVE_LIBRARY } from '../data/creativeLibrary';
import { loadAdvertisers } from '../data/advertisers';
import { loadSavedMonthlyReports } from './monthlyReportStore';
import { loadSavedProposals } from './nextMonthProposalStore';

export type AssetType = 'image' | 'video' | 'document' | 'creative' | 'template' | 'brand' | 'reference' | 'other';
export type AssetStatus = 'draft' | 'review' | 'approved' | 'active' | 'archived' | 'expired';
export type AssetUsageState = 'unused' | 'active' | 'past';
export type AssetSourceType = 'upload' | 'content' | 'creative-library' | 'monthly-report' | 'next-month-proposal' | 'reference' | 'external';

export type Asset = {
  assetId: string;
  name: string;
  originalFileName?: string;
  assetType: AssetType;
  documentType?: string;
  mimeType?: string;
  advertiserId?: string;
  advertiserName?: string;
  folderId?: string;
  storageUrl?: string;
  sourceRoute?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  pageCount?: number;
  tags: string[];
  systemTags?: string[];
  sourceType: AssetSourceType;
  sourceId?: string;
  status: AssetStatus;
  usageState?: AssetUsageState;
  favorite?: boolean;
  assetHash?: string;
  description?: string;
  creativeId?: string;
  parentCreativeId?: string;
  campaignId?: string;
  campaignName?: string;
  channel?: string;
  performanceState?: string;
  fatigueState?: string;
  spend?: number;
  db?: number;
  cpa?: number;
  roas?: number;
  relationLabels?: string[];
  version?: number;
  parentAssetId?: string;
  visibility?: 'private' | 'company' | 'advertiser' | 'link';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type AssetFolder = {
  folderId: string;
  name: string;
  advertiserId?: string;
  parentFolderId?: string;
  folderType: 'advertiser-root' | 'custom';
  createdAt: string;
  updatedAt: string;
};

const ASSET_KEY = 'howtom-universe-assets-v1';
const FOLDER_KEY = 'howtom-universe-asset-folders-v1';
const DB_NAME = 'howtom-universe-assets-db';
const DB_VERSION = 1;
const BLOB_STORE = 'blobs';

const nowIso = () => new Date().toISOString();

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function loadAssets(includeDeleted = false): Asset[] {
  const rows = safeParse<Asset[]>(localStorage.getItem(ASSET_KEY), []);
  const list = Array.isArray(rows) ? rows : [];
  return includeDeleted ? list : list.filter(row => !row.deletedAt);
}

export function saveAssets(rows: Asset[]) {
  localStorage.setItem(ASSET_KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent('howtom:assets-changed', { detail: rows }));
}

export function upsertAsset(asset: Asset) {
  const rows = loadAssets(true);
  const exists = rows.some(row => row.assetId === asset.assetId);
  saveAssets(exists ? rows.map(row => row.assetId === asset.assetId ? asset : row) : [asset, ...rows]);
  return asset;
}

export function patchAsset(assetId: string, patch: Partial<Asset>) {
  const rows = loadAssets(true);
  const current = rows.find(row => row.assetId === assetId);
  if (!current) return null;
  const updated = { ...current, ...patch, updatedAt: nowIso() };
  saveAssets(rows.map(row => row.assetId === assetId ? updated : row));
  return updated;
}

export function moveAssetsToTrash(ids: string[]) {
  const stamp = nowIso();
  const set = new Set(ids);
  const rows = loadAssets(true).map(row => set.has(row.assetId) ? { ...row, deletedAt: stamp, updatedAt: stamp } : row);
  saveAssets(rows);
}

export function restoreAssets(ids: string[]) {
  const set = new Set(ids);
  const rows = loadAssets(true).map(row => set.has(row.assetId) ? { ...row, deletedAt: undefined, updatedAt: nowIso() } : row);
  saveAssets(rows);
}

export async function permanentlyDeleteAssets(ids: string[]) {
  const set = new Set(ids);
  for (const id of ids) await deleteAssetBlob(id);
  saveAssets(loadAssets(true).filter(row => !set.has(row.assetId)));
}

export function loadFolders(): AssetFolder[] {
  const rows = safeParse<AssetFolder[]>(localStorage.getItem(FOLDER_KEY), []);
  return Array.isArray(rows) ? rows : [];
}

export function saveFolders(rows: AssetFolder[]) {
  localStorage.setItem(FOLDER_KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent('howtom:asset-folders-changed', { detail: rows }));
}

export function ensureAdvertiserFolders() {
  const advertisers = loadAdvertisers().filter(a => a.id !== 'default');
  const folders = loadFolders();
  const next = [...folders];
  advertisers.forEach(advertiser => {
    const id = `adv-root-${advertiser.id}`;
    if (!next.some(folder => folder.folderId === id)) {
      const stamp = nowIso();
      next.push({ folderId: id, name: advertiser.name, advertiserId: advertiser.id, folderType: 'advertiser-root', createdAt: stamp, updatedAt: stamp });
    }
  });
  if (next.length !== folders.length) saveFolders(next);
  return next;
}

export function createAssetFolder(name: string, advertiserId?: string, parentFolderId?: string) {
  const stamp = nowIso();
  const folder: AssetFolder = { folderId: `folder-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name, advertiserId, parentFolderId, folderType: 'custom', createdAt: stamp, updatedAt: stamp };
  saveFolders([folder, ...loadFolders()]);
  return folder;
}

function mapAdvertiser(name?: string) {
  if (!name) return undefined;
  return loadAdvertisers().find(a => a.name === name || a.id === name);
}

function sourceAssetRows(): Asset[] {
  const stamp = nowIso();
  const creativeAssets: Asset[] = CREATIVE_LIBRARY.map(creative => {
    const advertiser = mapAdvertiser(creative.brand);
    const type: AssetType = 'creative';
    const mime = creative.type === '영상' ? 'video/mp4' : creative.type === '이미지' ? 'image/jpeg' : 'text/plain';
    return {
      assetId: creative.assetId || `creative-${creative.id}`,
      name: creative.name,
      assetType: type,
      mimeType: mime,
      advertiserId: advertiser?.id,
      advertiserName: creative.brand,
      thumbnailUrl: undefined,
      tags: creative.tags ?? [],
      systemTags: [creative.type, creative.objective],
      sourceType: 'creative-library',
      sourceId: creative.id,
      sourceRoute: `/creatives/library/${creative.id}`,
      status: creative.liveStatus === '노출중' ? 'active' : creative.liveStatus === '보관됨' ? 'archived' : 'review',
      usageState: creative.uses > 0 ? (creative.liveStatus === '노출중' ? 'active' : 'past') : 'unused',
      creativeId: creative.id,
      parentCreativeId: creative.parentCreativeId,
      campaignId: creative.campaignId,
      campaignName: creative.campaignName,
      channel: creative.platform,
      performanceState: creative.status,
      fatigueState: creative.fatigue,
      spend: creative.spend,
      relationLabels: [`운영센터 → 소재 관리 · ${creative.uses}회 사용`, creative.campaignName ? `캠페인 · ${creative.campaignName}` : '광고 소재 라이브러리'],
      createdAt: new Date(`${creative.date}T09:00:00`).toISOString(),
      updatedAt: new Date(`${creative.date}T09:00:00`).toISOString(),
    };
  });

  const reports: Asset[] = loadSavedMonthlyReports().map(report => {
    const advertiser = mapAdvertiser(report.advertiserName);
    return {
      assetId: `report-${report.id}`,
      name: report.label,
      assetType: 'document',
      documentType: '월간 보고서',
      mimeType: 'application/pdf',
      advertiserId: advertiser?.id,
      advertiserName: report.advertiserName,
      tags: ['보고서', report.month],
      sourceType: 'monthly-report',
      sourceId: report.id,
      sourceRoute: '/monthly-reports',
      status: 'approved',
      usageState: 'past',
      relationLabels: ['운영센터 → 월간 보고서'],
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      fileSize: 0,
    };
  });

  const proposals: Asset[] = loadSavedProposals().map(proposal => {
    const advertiser = mapAdvertiser(proposal.advertiserName);
    return {
      assetId: `proposal-${proposal.id}`,
      name: proposal.label,
      assetType: 'document',
      documentType: '다음달 제안서',
      mimeType: 'application/pdf',
      advertiserId: advertiser?.id,
      advertiserName: proposal.advertiserName,
      tags: ['제안서', proposal.targetMonth],
      sourceType: 'next-month-proposal',
      sourceId: proposal.id,
      sourceRoute: '/next-month-proposal',
      status: 'approved',
      usageState: 'past',
      relationLabels: ['운영센터 → 다음달 제안서'],
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      fileSize: 0,
    };
  });

  return [...creativeAssets, ...reports, ...proposals].map(row => ({ ...row, createdAt: row.createdAt || stamp, updatedAt: row.updatedAt || stamp }));
}

/** 기존 소재/보고서/제안서를 자산 인덱스에 1회만 연결합니다. 동일 ID는 복제하지 않습니다. */
export function syncExistingAssets() {
  ensureAdvertiserFolders();
  const current = loadAssets(true);
  const byId = new Map(current.map(row => [row.assetId, row]));
  let changed = false;
  sourceAssetRows().forEach(source => {
    const existing = byId.get(source.assetId);
    if (!existing) {
      byId.set(source.assetId, source);
      changed = true;
    } else {
      const merged: Asset = {
        ...source,
        ...existing,
        name: existing.name || source.name,
        tags: Array.from(new Set([...(source.tags || []), ...(existing.tags || [])])),
        relationLabels: Array.from(new Set([...(source.relationLabels || []), ...(existing.relationLabels || [])])),
        sourceRoute: source.sourceRoute || existing.sourceRoute,
        updatedAt: existing.updatedAt || source.updatedAt,
      };
      byId.set(source.assetId, merged);
    }
  });
  if (changed) saveAssets(Array.from(byId.values()));
  return Array.from(byId.values()).filter(row => !row.deletedAt);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAssetBlob(assetId: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).put(blob, assetId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadAssetBlob(assetId: string): Promise<Blob | null> {
  const db = await openDb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const req = tx.objectStore(BLOB_STORE).get(assetId);
    req.onsuccess = () => resolve((req.result as Blob) || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteAssetBlob(assetId: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).delete(assetId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function classifyFile(file: File): AssetType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('text/') || /(pdf|word|excel|sheet|presentation|powerpoint|csv|officedocument)/i.test(file.type)) return 'document';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['jpg','jpeg','png','webp','gif','bmp','svg'].includes(ext || '')) return 'image';
  if (['mp4','mov','webm','avi','m4v'].includes(ext || '')) return 'video';
  if (['pdf','doc','docx','ppt','pptx','xls','xlsx','csv','txt','md'].includes(ext || '')) return 'document';
  return 'other';
}

export function humanFileSize(bytes?: number) {
  if (!bytes) return '-';
  const units = ['B','KB','MB','GB'];
  let value = bytes; let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatDuration(seconds?: number) {
  if (!seconds && seconds !== 0) return '-';
  const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

async function imageMeta(file: File): Promise<{ width?: number; height?: number; thumbnailUrl?: string }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 420;
      const ratio = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * ratio));
      canvas.height = Math.max(1, Math.round(img.height * ratio));
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const thumbnailUrl = canvas.toDataURL('image/webp', .78);
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height, thumbnailUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({}); };
    img.src = url;
  });
}

async function videoMeta(file: File): Promise<{ width?: number; height?: number; duration?: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const result = { width: video.videoWidth, height: video.videoHeight, duration: Number.isFinite(video.duration) ? video.duration : undefined };
      URL.revokeObjectURL(url); resolve(result);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve({}); };
    video.src = url;
  });
}

export async function createAssetsFromFiles(files: File[], opts: { advertiserId?: string; folderId?: string; tags?: string[]; status?: AssetStatus; description?: string } = {}) {
  const advertisers = loadAdvertisers();
  const advertiser = advertisers.find(a => a.id === opts.advertiserId);
  const existing = loadAssets(true);
  const created: Asset[] = [];
  for (const file of files) {
    const assetHash = `${file.name}|${file.size}|${file.lastModified}`;
    const duplicate = existing.find(row => row.assetHash === assetHash && !row.deletedAt);
    if (duplicate) continue;
    const assetType = classifyFile(file);
    const meta = assetType === 'image' ? await imageMeta(file) : assetType === 'video' ? await videoMeta(file) : {};
    const stamp = nowIso();
    const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const asset: Asset = {
      assetId,
      name: file.name.replace(/\.[^.]+$/, ''),
      originalFileName: file.name,
      assetType,
      mimeType: file.type || undefined,
      advertiserId: advertiser?.id,
      advertiserName: advertiser?.name,
      folderId: opts.folderId,
      fileSize: file.size,
      width: 'width' in meta ? meta.width : undefined,
      height: 'height' in meta ? meta.height : undefined,
      duration: 'duration' in meta ? meta.duration : undefined,
      thumbnailUrl: 'thumbnailUrl' in meta ? meta.thumbnailUrl : undefined,
      tags: opts.tags ?? [],
      sourceType: 'upload',
      status: opts.status ?? 'draft',
      usageState: 'unused',
      assetHash,
      description: opts.description,
      relationLabels: ['직접 업로드'],
      createdAt: stamp,
      updatedAt: stamp,
    };
    await saveAssetBlob(assetId, file);
    created.push(asset);
    existing.push(asset);
  }
  if (created.length) saveAssets([...created, ...loadAssets(true)]);
  return created;
}


export async function duplicateAsset(assetId: string) {
  const rows = loadAssets(true);
  const original = rows.find(row => row.assetId === assetId);
  if (!original) return null;
  const rootId = original.parentAssetId || original.assetId;
  const related = rows.filter(row => row.assetId === rootId || row.parentAssetId === rootId);
  const version = Math.max(0, ...related.map(row => row.version || 1)) + 1;
  const stamp = nowIso();
  const nextId = `asset-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const copy: Asset = {
    ...original,
    assetId: nextId,
    name: `${original.name} (복사본)`,
    sourceType: original.sourceType === 'upload' ? 'upload' : original.sourceType,
    sourceId: original.sourceId,
    parentAssetId: rootId,
    version,
    assetHash: undefined,
    favorite: false,
    deletedAt: undefined,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const blob = await loadAssetBlob(original.assetId);
  if (blob) await saveAssetBlob(nextId, blob);
  saveAssets([copy, ...rows]);
  return copy;
}

export function assetVersions(asset: Asset) {
  const rows = loadAssets(true);
  const rootId = asset.parentAssetId || asset.assetId;
  return rows.filter(row => row.assetId === rootId || row.parentAssetId === rootId)
    .sort((a, b) => (b.version || 1) - (a.version || 1));
}

export async function downloadAsset(asset: Asset) {
  if (asset.sourceRoute && !asset.originalFileName) {
    window.location.href = asset.sourceRoute;
    return;
  }
  const blob = await loadAssetBlob(asset.assetId);
  if (!blob) {
    if (asset.storageUrl) window.open(asset.storageUrl, '_blank', 'noopener,noreferrer');
    else if (asset.sourceRoute) window.location.href = asset.sourceRoute;
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = asset.originalFileName || asset.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
