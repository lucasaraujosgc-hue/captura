export function getToken() {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

export function setToken(token: string, remember: boolean) {
  if (remember) {
    localStorage.setItem('auth_token', token);
    sessionStorage.removeItem('auth_token');
  } else {
    sessionStorage.setItem('auth_token', token);
    localStorage.removeItem('auth_token');
  }
}

export function logout() {
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_token');
  window.location.reload();
}

export function getAuthHeaders() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
