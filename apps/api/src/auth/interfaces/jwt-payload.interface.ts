export interface JwtPayload {
  sub: string; // userId (cuid)
  email: string;
  role: string;
  plan: string;
  iat?: number;
  exp?: number;
}
