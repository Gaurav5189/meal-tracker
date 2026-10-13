import { apiGet, apiPost } from "../../lib/api";

export interface Me {
  username: string;
  name: string;
  tz: string;
}

export const meQueryKey = ["me"] as const;

export interface SignupPayload {
  name: string;
  username: string;
  password: string;
  tz: string;
}

export interface LoginPayload {
  username: string;
  password: string;
  tz: string;
}

export const fetchMe = () => apiGet<Me>("/me");
export const signup = (payload: SignupPayload) => apiPost<Me>("/auth/signup", payload);
export const login = (payload: LoginPayload) => apiPost<Me>("/auth/login", payload);
export const logout = () => apiPost<{ ok: boolean }>("/auth/logout");
