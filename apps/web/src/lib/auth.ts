const TOKEN_KEY = 'ds_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  document.cookie = `ds_auth=1; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = 'ds_auth=; path=/; max-age=0'
}

export function isAuthenticated(): boolean {
  return Boolean(getToken())
}
