import { ApiAdControlRepository } from './ApiAdControlRepository';
import { MockAdControlRepository } from './MockAdControlRepository';
const mode=import.meta.env.VITE_REPOSITORY_MODE ?? 'mock';
export const adControlRepository = mode==='api'
  ? new ApiAdControlRepository(import.meta.env.VITE_API_BASE_URL ?? '', import.meta.env.VITE_API_ACCESS_TOKEN)
  : new MockAdControlRepository();
export type { AdControlRepository } from './AdControlRepository';
