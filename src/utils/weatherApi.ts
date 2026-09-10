import { apiFetch } from '../hooks/useApi';

export type WeatherInfo = { region: string; tempC: number | null; description: string; icon: string; humidity: number | null; condition: string };
export type WeatherRule = { id: string; condition: string; temp_min: number | null; temp_max: number | null; industry: string | null; recommended_message: string; recommended_tags: string[]; enabled: boolean; created_at: string };
export type SeasonEventRow = { id: string; date: string; title: string; type: string; region: string | null; severity: string | null; recommendation: string | null; label: string; tone: string; subtitle: string; status: string };

export const weatherApi = {
  status: () => apiFetch<{ configured: boolean }>('/weather/status'),
  suggestions: (region: string, industry?: string) =>
    apiFetch<{ weather: WeatherInfo; matched: WeatherRule[] }>(`/weather/suggestions?region=${encodeURIComponent(region)}${industry ? `&industry=${encodeURIComponent(industry)}` : ''}`),
  rules: {
    list: () => apiFetch<{ items: WeatherRule[] }>('/weather-rules').then(r => r.items),
    create: (input: { condition: string; tempMin?: number; tempMax?: number; industry?: string; recommendedMessage: string; tags?: string[] }) =>
      apiFetch<WeatherRule>('/weather-rules', { method: 'POST', body: JSON.stringify(input) }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/weather-rules/${id}`, { method: 'DELETE' }),
    toggle: (id: string, enabled: boolean) => apiFetch<{ ok: true }>(`/weather-rules/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  },
  seasonEvents: {
    list: () => apiFetch<SeasonEventRow[]>('/season-events'),
    create: (input: { date: string; title: string; label: string; subtitle: string; tone?: string }) =>
      apiFetch<SeasonEventRow>('/season-events', { method: 'POST', body: JSON.stringify(input) }),
    toggleStatus: (id: string, status: string) => apiFetch<{ ok: true }>(`/season-events/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/season-events/${id}`, { method: 'DELETE' }),
  },
};
