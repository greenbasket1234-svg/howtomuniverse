import { apiFetch } from '../../hooks/useApi';

export type ImagePlanInput = {
  visualType?: string;
  subject?: string;
  background?: string;
  mainText?: string;
  ratio?: string;
  extraPrompt?: string;
};

export type GeneratedImage = { url: string | null; base64: string | null; revisedPrompt: string };

export const imageApi = {
  aiStatus: () => apiFetch<{ configured: boolean; provider: string | null }>('/images/ai-status'),
  generate: (plan: ImagePlanInput) =>
    apiFetch<{ generator: string; images: GeneratedImage[]; prompt: string }>('/images/generate', {
      method: 'POST',
      body: JSON.stringify(plan),
    }),
};
