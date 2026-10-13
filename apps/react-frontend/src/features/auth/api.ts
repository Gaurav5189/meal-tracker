import { apiGet, apiPatch, apiPost } from "../../lib/api";

export interface Me {
  username: string;
  name: string;
  tz: string;
  onboarded: boolean;
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

export interface MeUpdatePayload {
  name: string;
  /** Set true by the intro popup confirm; omit to leave unchanged. */
  onboarded?: boolean;
}

export const fetchMe = () => apiGet<Me>("/me");
export const signup = (payload: SignupPayload) => apiPost<Me>("/auth/signup", payload);
export const login = (payload: LoginPayload) => apiPost<Me>("/auth/login", payload);
export const logout = () => apiPost<{ ok: boolean }>("/auth/logout");
export const updateMe = (payload: MeUpdatePayload) => apiPatch<Me>("/me", payload);
