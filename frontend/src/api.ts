// Thin fetch wrapper. Cookies carry the session, so we always send credentials.

export interface User {
  id: number;
  name: string;
  username: string;
  isAdmin: boolean;
  createdAt?: string;
}

export interface House {
  id: number;
  name: string;
  location?: string | null;
  createdAt?: string;
  paymentCount?: number;
}

export interface Period {
  year: number;
  month: number;
}

export interface Attachment {
  id: number;
  filename: string;
  mime: string;
  size: number;
}

export interface Payment {
  id: number;
  houseId: number;
  house?: { id: number; name: string };
  amount: number;
  paidOn: string;
  note?: string | null;
  category?: string | null;
  status: "PAID" | "UNPAID";
  createdAt: string;
  createdBy?: { id: number; name: string } | null;
  periods: Period[];
  attachments: Attachment[];
}

export interface Summary {
  year: number | null;
  yearTotal: number;
  grandTotal: number;
  byMonth: { month: number; total: number }[];
  byHouse: { id: number; name: string; total: number }[];
  byYear: { year: number; total: number }[];
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function json<T>(url: string, method: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const api = {
  // auth
  me: () => request<{ user: User }>("/api/auth/me"),
  login: (username: string, password: string) =>
    json<{ user: User }>("/api/auth/login", "POST", { username, password }),
  logout: () => json<{ ok: boolean }>("/api/auth/logout", "POST"),
  changePassword: (currentPassword: string, newPassword: string) =>
    json("/api/auth/change-password", "POST", { currentPassword, newPassword }),

  // users
  listUsers: () => request<{ users: User[] }>("/api/users"),
  createUser: (data: { name: string; username: string; password: string; isAdmin: boolean }) =>
    json<{ user: User }>("/api/users", "POST", data),
  updateUser: (id: number, data: Partial<Pick<User, "name" | "username" | "isAdmin">>) =>
    json<{ user: User }>(`/api/users/${id}`, "PUT", data),
  resetPassword: (id: number, newPassword: string) =>
    json(`/api/users/${id}/reset-password`, "POST", { newPassword }),
  deleteUser: (id: number) => json(`/api/users/${id}`, "DELETE"),

  // houses
  listHouses: () => request<{ houses: House[] }>("/api/houses"),
  getHouse: (id: number) => request<{ house: House }>(`/api/houses/${id}`),
  createHouse: (data: { name: string; location?: string }) =>
    json<{ house: House }>("/api/houses", "POST", data),
  updateHouse: (id: number, data: { name: string; location?: string }) =>
    json<{ house: House }>(`/api/houses/${id}`, "PUT", data),
  deleteHouse: (id: number) => json(`/api/houses/${id}`, "DELETE"),

  // payments
  listPayments: (params: { houseId?: number; year?: number; month?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.houseId) qs.set("houseId", String(params.houseId));
    if (params.year) qs.set("year", String(params.year));
    if (params.month) qs.set("month", String(params.month));
    const q = qs.toString();
    return request<{ payments: Payment[] }>(`/api/payments${q ? `?${q}` : ""}`);
  },
  createPayment: (form: FormData) =>
    request<{ payment: Payment }>("/api/payments", { method: "POST", body: form }),
  updatePayment: (id: number, data: any) =>
    json<{ payment: Payment }>(`/api/payments/${id}`, "PUT", data),
  deletePayment: (id: number) => json(`/api/payments/${id}`, "DELETE"),
  addAttachments: (id: number, form: FormData) =>
    request<{ payment: Payment }>(`/api/payments/${id}/attachments`, {
      method: "POST",
      body: form,
    }),
  deleteAttachment: (attId: number) => json(`/api/payments/attachments/${attId}`, "DELETE"),
  attachmentUrl: (attId: number) => `/api/payments/attachments/${attId}/download`,

  // stats
  years: () => request<{ years: number[] }>("/api/stats/years"),
  summary: (params: { year?: number; houseId?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.year) qs.set("year", String(params.year));
    if (params.houseId) qs.set("houseId", String(params.houseId));
    const q = qs.toString();
    return request<Summary>(`/api/stats/summary${q ? `?${q}` : ""}`);
  },

  // settings
  getSettings: () => request<{ settings: Record<string, string> }>("/api/settings"),
  updateSettings: (data: { currency?: string; appName?: string }) =>
    json<{ settings: Record<string, string> }>("/api/settings", "PUT", data),

  // backup
  exportUrl: () => "/api/backup/export",
  importBackup: (form: FormData) =>
    request<{ ok: boolean; message: string }>("/api/backup/import", {
      method: "POST",
      body: form,
    }),
};
