import { ApiAdControlRepository } from './ApiAdControlRepository';
import { MockAdControlRepository } from './MockAdControlRepository';
const mode=import.meta.env.PROD ? 'api' : (import.meta.env.VITE_REPOSITORY_MODE ?? 'api');
export const adControlRepository = mode==='api'
  ? new ApiAdControlRepository()
  : new MockAdControlRepository();
export type { AdControlRepository } from './AdControlRepository';
