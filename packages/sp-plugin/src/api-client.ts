export const API_BASE_URL = 'https://sppet.scsldr.cn/api/v1';
export const SITE_ORIGIN = 'https://sppet.scsldr.cn';

export interface ReleaseManifest {
  version: string;
  downloadUrl: string;
  changelog: string;
  sha256: string;
  minCompatibleVersion: string;
}

type Request = (url: string, options?: Record<string, unknown>) => Promise<unknown>;

export class ApiClient {
  constructor(private readonly request: Request, private token = '') {}
  setToken(token: string): void { this.token = token; }
  private call<T>(path: string, options: Record<string, unknown> = {}): Promise<T> { const headers = { ...(options.headers as Record<string, string> ?? {}), ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) }; return this.request(`${API_BASE_URL}${path}`, { timeout: 5000, ...options, headers }) as Promise<T>; }
  status(): Promise<unknown> { return this.call('/status'); }
  config(): Promise<unknown> { return this.call('/config'); }
  registerDevice(deviceId: string, displayName: string): Promise<{ userId: string; token: string }> { return this.call('/profile/register-device', { method: 'POST', body: { deviceId, displayName } }); }
  updateProfile(displayName: string): Promise<unknown> { return this.call('/profile', { method: 'PUT', body: { displayName } }); }
  submitLeaderboard(body: Record<string, unknown>): Promise<unknown> { return this.call('/leaderboard/submit', { method: 'POST', body }); }
  content(): Promise<unknown> { return this.call('/store/catalog'); }
  items(): Promise<unknown> { return this.call('/items/catalog'); }
  equipment(): Promise<unknown> { return this.call('/equipment/catalog'); }
  skills(): Promise<unknown> { return this.call('/skills/catalog'); }
  releasesLatest(): Promise<ReleaseManifest> { return this.call('/releases/latest'); }
  releasesManifest(): Promise<ReleaseManifest> { return this.call('/releases/manifest'); }
  events(): Promise<unknown> { return this.call('/events'); }
}
