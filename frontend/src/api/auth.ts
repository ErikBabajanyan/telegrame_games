import { api } from './client';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    telegramId: number;
    username: string | null;
    firstName: string;
    role: string;
  };
}

/** Authenticate via Telegram initData */
export async function loginWithTelegram(initData: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/telegram', { initData });
  sessionStorage.setItem('accessToken', data.accessToken);
  sessionStorage.setItem('refreshToken', data.refreshToken);
  return data;
}

/** Refresh access token */
export async function refreshToken(token: string) {
  const { data } = await api.post('/auth/refresh', { refreshToken: token });
  sessionStorage.setItem('accessToken', data.accessToken);
  sessionStorage.setItem('refreshToken', data.refreshToken);
  return data;
}

/** Logout */
export async function logout() {
  const refreshToken = sessionStorage.getItem('refreshToken');
  try {
    await api.post('/auth/logout', { refreshToken });
  } finally {
    sessionStorage.clear();
  }
}
