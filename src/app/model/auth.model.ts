export interface LoginRequest {
  username: string;
  password: string;
}

/** Mirrors backend LoginResponse (pratik-dairy-user / dto/LoginResponse.java). */
export interface JwtResponse {
  token: string;
  refreshToken: string;
  username: string;
  role: string; // 'ROLE_ADMIN' | 'ROLE_CUSTOMER'
}

/** Mirrors backend RefreshTokenResponse (pratik-dairy-user / dto/RefreshTokenResponse.java). */
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  username: string;
  role: string;
}

export interface AuthState {
  token: string;
  username: string;
  role: string;
}