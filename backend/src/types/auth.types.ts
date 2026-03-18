export interface JwtPayload {
  userId: string;
  telegramId: number;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string;
  role: string;
}

export interface AuthResult extends AuthTokens {
  user: AuthUser;
}

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}
