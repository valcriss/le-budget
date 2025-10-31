export interface UserSettings {
  currency: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  settings: UserSettings;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName?: string | null;
}
