import { apiPatch, apiPost } from "../../lib/api";
import type { Me } from "../auth/api";

export interface NameUpdatePayload {
  name: string;
}

export interface PasswordChangePayload {
  current_password: string;
  new_password: string;
}

export const updateName = (payload: NameUpdatePayload) => apiPatch<Me>("/me", payload);

export const changePassword = (payload: PasswordChangePayload) =>
  apiPost<{ ok: boolean }>("/me/password", payload);
