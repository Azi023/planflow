export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'planner' | 'account_manager';
}

const TOKEN_KEY = 'planflow_token';
const USER_KEY = 'planflow_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  planner: 'Planner',
  account_manager: 'Account Manager',
};
