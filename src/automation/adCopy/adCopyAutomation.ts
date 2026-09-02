import { createProject, type CopyVariant } from '../../utils/contentStore';
import { subscriptionApi } from '../../utils/subscriptionApi';
import { createRun, finishRun } from '../execution/executionStore';
import { removeAutomationJob, upsertAutomationJob } from '../automationStore';
import { apiFetch } from '../../hooks/useApi';

export type AdCopyProvider = 'template' | 'openai' | 'claude';
export type AdCopyAutomationConfig = {
  configId: string;
  advertiserId: string;
  advertiserName: string;
  channel: string;
  objective: string;
  productName: string;
  targetAudience?: string;
  keyBenefit?: string;
  hookType?: string;
  cta?: string;
  tone?: string;
  provider: AdCopyProvider;
  cadence: 'manual' | 'weekly' | 'monthly';
  weekday?: number;
  dayOfMonth?: number;
  time: string;
  variantCount: number;
  saveAsDraft: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const KEY = 'howtom-ad-copy-automation-configs-v1';
function read(): AdCopyAutomationConfig[] { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function emit() { try { window.dispatchEvent(new CustomEvent('howtom-automation-updated')); } catch {} }
export function loadAdCopyAutomationConfigs() { return read(); }
export function saveAdCopyAutomationConfigs(rows: AdCopyAutomationConfig[]) { localStorage.setItem(KEY, JSON.stringify(rows)); emit(); }
export function upsertAdCopyAutomationConfig(row: AdCopyAutomationConfig) {
  const rows = read(); const next = { ...row, updatedAt: new Date().toISOString() }; saveAdCopyAutomationConfigs(rows.some(x => x.configId === row.configId) ? rows.map(x => x.configId === row.configId ? next : x) : [next, ...rows]);
  if (next.cadence !== 'manual') upsertAutomationJob({
    jobId: `adcopy-config-${next.configId}`, name: `${next.advertiserName} 광고 문구 자동 생성`, jobType: 'content_generation', advertiserId: next.advertiserId, advertiserName: next.advertiserName, targetType: 'advertiser', targetId: next.advertiserId, targetName: next.advertiserName,
    schedule: next.cadence === 'weekly' ? { scheduleType:'weekly', time:next.time, daysOfWeek:[next.weekday ?? 1], timezone:'Asia/Seoul' } : { scheduleType:'monthly', time:next.time, dayOfMonth:next.dayOfMonth ?? 1, timezone:'Asia/Seoul' },
    status: next.enabled ? 'active' : 'paused', implementationStatus: 'mock', source:'scheduler', createdAt:next.createdAt, updatedAt:next.updatedAt,
  }); else removeAutomationJob(`adcopy-config-${next.configId}`);
  return next;
}
export function deleteAdCopyAutomationConfig(configId: string) { saveAdCopyAutomationConfigs(read().filter(x => x.configId !== configId)); removeAutomationJob(`adcopy-config-${configId}`); }

function text(value?: string, fallback = '') { return value?.trim() || fallback; }

function templateVariants(config: AdCopyAutomationConfig): CopyVariant[] {
  const product = text(config.productName, config.advertiserName);
  const benefit = text(config.keyBenefit, '핵심 혜택을 확인해보세요');
  const audience = text(config.targetAudience, '필요한 분');
  const cta = text(config.cta, '더 알아보기');
  const hook = text(config.hookType, '직관형');
  const tone = text(config.tone, '명확하고 간결한');
  const candidates = [
    { label: 'A안', angle: hook, headline: `${product}, 지금 확인해보세요`, body: `${audience}을 위한 ${tone} 안내입니다. ${benefit}.`, description: `${benefit}`, cta },
    { label: 'B안', angle: '문제 해결형', headline: `${product} 선택이 고민이라면`, body: `복잡하게 비교하지 마세요. ${benefit}. 필요한 정보만 빠르게 확인할 수 있습니다.`, description: `${product} 핵심 정보 확인`, cta },
    { label: 'C안', angle: '혜택 강조형', headline: `${benefit}`, body: `${product}의 핵심 포인트를 한 번에 확인하세요. ${audience}에게 필요한 내용을 중심으로 구성했습니다.`, description: `${product} 자세히 보기`, cta },
    { label: 'D안', angle: '신뢰형', headline: `${product}, 기준부터 확인하세요`, body: `결정 전에 꼭 확인해야 할 핵심 기준과 ${benefit}을 정리했습니다.`, description: `기준을 알고 선택하세요`, cta },
    { label: 'E안', angle: '간결형', headline: `${product} 핵심만 빠르게`, body: `${benefit}. 자세한 내용은 지금 확인해보세요.`, description: `${product} 핵심 요약`, cta },
  ];
  return candidates.slice(0, Math.max(1, Math.min(5, config.variantCount || 3))).map((v, i) => ({ ...v, variantId: `copy-${Date.now()}-${i}` }));
}

/** 광고 문구는 이제 두 갈래입니다: 'template'(로컬, 항상 됨) / 'openai'|'claude'(서버에
 * AD_COPY_AI_PROVIDER가 연결되어 있으면 실제 AI가 생성, 없으면 정직하게 보류). 블로그·
 * 이미지 생성과 동일한 패턴입니다 - 서버 연결 전에도 템플릿 경로는 항상 정상 동작합니다. */
export async function generateAdCopyNow(config: AdCopyAutomationConfig) {
  const run = createRun({ jobId: `adcopy-config-${config.configId}`, jobName: `${config.advertiserName} 광고 문구 생성`, advertiserId: config.advertiserId, advertiserName: config.advertiserName, type: 'ad-copy', trigger: 'manual', status: 'running', inputSummary: { channel: config.channel, provider: config.provider, objective: config.objective } });
  try {
    let variants: CopyVariant[];
    let generatorLabel = 'template';
    if (config.provider === 'template') {
      variants = templateVariants(config);
    } else {
      const status = await apiFetch<{ configured: boolean; provider: string | null }>('/ad-copy/ai-status');
      if (!status.configured) {
        return finishRun(run.runId, { status: 'blocked', error: { code: 'AI_PROVIDER_NOT_CONNECTED', message: `${config.provider === 'openai' ? 'OpenAI' : 'Claude'} API는 아직 서버에 연결되지 않았습니다. 관리자가 AD_COPY_AI_PROVIDER를 연결하면 실행됩니다. 그 전까지는 템플릿 기반 생성을 이용하세요.` } });
      }
      const result = await apiFetch<{ variants: CopyVariant[]; generator: string }>('/ad-copy/generate', {
        method: 'POST',
        body: JSON.stringify({ advertiserName: config.advertiserName, channel: config.channel, productName: config.productName, objective: config.objective, targetAudience: config.targetAudience, keyBenefit: config.keyBenefit, hookType: config.hookType, tone: config.tone, cta: config.cta, variantCount: config.variantCount }),
      });
      variants = result.variants;
      generatorLabel = result.generator;
    }
    const project = createProject({
      projectType: 'ad', title: `${config.advertiserName} ${config.channel} 광고 문구 · 자동화 초안`, advertiserId: config.advertiserId, advertiserName: config.advertiserName,
      channel: config.channel, objective: config.objective || '전환', creativeType: '광고 문구', target: config.targetAudience, keyBenefit: config.keyBenefit,
      referenceIds: [], hooks: variants.map(v => v.headline), copyVariants: variants, resultAssetIds: [], status: 'draft',
      hookType: config.hookType,
    });
    await subscriptionApi.recordUsage({ advertiserId: config.advertiserId, feature: 'ad-creation', action: 'generate', quantity: 1, sourceId: project.projectId, provider: generatorLabel, providerCost: 0, aiCost: 0 });
    return finishRun(run.runId, { status: 'success', outputSummary: { projectId: project.projectId, variantCount: variants.length, provider: generatorLabel, aiCost: 0 }, steps: [
      { stepId: 'input', name: '광고주·매체·목적 입력 정리', status: 'success' },
      { stepId: 'generate', name: generatorLabel === 'template' ? '규칙/템플릿 기반 A/B/C 문구 생성' : '외부 AI로 문구 생성', status: 'success' },
      { stepId: 'content', name: '콘텐츠 제작 프로젝트에 초안 저장', status: 'success' },
    ] });
  } catch (error) {
    return finishRun(run.runId, { status: 'failed', error: { code: 'AD_COPY_GENERATION_FAILED', message: error instanceof Error ? error.message : '광고 문구 생성 중 오류가 발생했습니다.' } });
  }
}
