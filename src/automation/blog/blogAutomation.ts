import { blogApi } from '../../features/blog/blogApi';
import { createRun, finishRun } from '../execution/executionStore';
import { removeAutomationJob, upsertAutomationJob } from '../automationStore';

export type BlogAutomationConfig = {
  configId: string;
  advertiserId: string;
  advertiserName: string;
  industry?: string;
  platform: string;
  contentType: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  region?: string;
  targetLength: number;
  tone?: string;
  cta?: string;
  cadence: 'manual' | 'weekly' | 'monthly';
  weekday?: number;
  dayOfMonth?: number;
  time: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const KEY = 'howtom-blog-automation-configs-v1';
function read(): BlogAutomationConfig[] { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function emit() { try { window.dispatchEvent(new CustomEvent('howtom-automation-updated')); } catch { /* noop */ } }

export function loadBlogAutomationConfigs() { return read(); }
export function saveBlogAutomationConfigs(rows: BlogAutomationConfig[]) { localStorage.setItem(KEY, JSON.stringify(rows)); emit(); }

export function upsertBlogAutomationConfig(row: BlogAutomationConfig) {
  const rows = read();
  const next = { ...row, updatedAt: new Date().toISOString() };
  saveBlogAutomationConfigs(rows.some(x => x.configId === row.configId) ? rows.map(x => x.configId === row.configId ? next : x) : [next, ...rows]);
  if (next.cadence !== 'manual') {
    upsertAutomationJob({
      jobId: `blog-config-${next.configId}`, name: `${next.advertiserName} 블로그 자동 생성`, jobType: 'blog_generation',
      advertiserId: next.advertiserId, advertiserName: next.advertiserName, targetType: 'advertiser', targetId: next.advertiserId, targetName: next.advertiserName,
      schedule: next.cadence === 'weekly'
        ? { scheduleType: 'weekly', time: next.time, daysOfWeek: [next.weekday ?? 1], timezone: 'Asia/Seoul' }
        : { scheduleType: 'monthly', time: next.time, dayOfMonth: next.dayOfMonth ?? 1, timezone: 'Asia/Seoul' },
      status: next.enabled ? 'active' : 'paused', implementationStatus: 'mock', source: 'scheduler', createdAt: next.createdAt, updatedAt: next.updatedAt,
    });
  } else {
    removeAutomationJob(`blog-config-${next.configId}`);
  }
  return next;
}

export function deleteBlogAutomationConfig(configId: string) {
  saveBlogAutomationConfigs(read().filter(x => x.configId !== configId));
  removeAutomationJob(`blog-config-${configId}`);
}

/**
 * 광고 문구 자동화와 달리, 블로그 생성은 로컬 템플릿 대체 수단이 없습니다(기존 블로그 제작
 * 화면 자체가 외부 AI 연결 없이는 생성하지 않는 정직한 설계이므로, 자동화도 그 설계를
 * 그대로 따릅니다 - 가짜 초안을 만들어내지 않습니다).
 */
export async function generateBlogNow(config: BlogAutomationConfig) {
  const run = createRun({
    jobId: `blog-config-${config.configId}`, jobName: `${config.advertiserName} 블로그 생성`,
    advertiserId: config.advertiserId, advertiserName: config.advertiserName, type: 'blog', trigger: 'manual', status: 'running',
    inputSummary: { keyword: config.primaryKeyword, platform: config.platform, targetLength: config.targetLength },
  });
  try {
    const status = await blogApi.aiStatus();
    if (!status.configured) {
      return finishRun(run.runId, { status: 'blocked', error: { code: 'AI_PROVIDER_NOT_CONNECTED', message: '블로그 AI가 아직 서버에 연결되지 않았습니다. 관리자가 외부 AI API(BLOG_AI_PROVIDER)를 연결하면 자동 생성이 실행됩니다.' } });
    }
    const result = await blogApi.generate({
      advertiserName: config.advertiserName, industry: config.industry, platform: config.platform, contentType: config.contentType,
      primaryKeyword: config.primaryKeyword, secondaryKeywords: config.secondaryKeywords, region: config.region,
      targetLength: config.targetLength, tone: config.tone,
    } as Record<string, unknown>);
    if (result.aiError) {
      return finishRun(run.runId, { status: 'failed', error: { code: 'BLOG_AI_ERROR', message: result.aiError } });
    }
    const project = await blogApi.createProject({
      advertiserId: config.advertiserId, advertiserName: config.advertiserName, industry: config.industry || '', platform: config.platform,
      contentType: config.contentType, purpose: '자동화 생성', primaryKeyword: config.primaryKeyword, secondaryKeywords: config.secondaryKeywords,
      region: config.region || '', targetLength: config.targetLength, tone: config.tone || '',
      titleOptions: result.titles, selectedTitle: result.titles[0] || '', blocks: result.blocks, status: 'draft',
    });
    return finishRun(run.runId, {
      status: 'success',
      outputSummary: { projectId: project.projectId, titleCount: result.titles.length, blockCount: result.blocks.length, provider: result.generator },
      steps: [
        { stepId: 'input', name: '키워드·톤·분량 입력 정리', status: 'success' },
        { stepId: 'generate', name: '외부 AI로 제목·본문 생성', status: 'success' },
        { stepId: 'save', name: '블로그 제작 프로젝트로 저장', status: 'success' },
      ],
    });
  } catch (error) {
    return finishRun(run.runId, { status: 'failed', error: { code: 'BLOG_GENERATION_FAILED', message: error instanceof Error ? error.message : '블로그 생성 중 오류가 발생했습니다.' } });
  }
}
