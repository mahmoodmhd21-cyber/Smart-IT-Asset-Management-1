const API_BASE = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("authToken");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed: ${res.status}`);
  }
  return data as T;
}

export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: "Admin" | "IT Staff";
  createdDate: string;
}

export interface Asset {
  _id: string;
  assetName: string;
  status: "Available" | "Allocated" | "Maintenance" | "Retired";
  location: string;
  category: string;
  brand: string;
  model: string;
  purchaseDate: string;
}

export interface Allocation {
  _id: string;
  asset: Asset;
  user: User;
  allocationDate: string;
  returnDate?: string;
  allocationStatus: "Allocated" | "Returned" | "Pending";
  remarks?: string;
}

export const auth = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (fullName: string, email: string, password: string, role?: string) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ fullName, email, password, role }),
    }),
  me: () => request<{ user: User }>("/auth/me"),
  getAllUsers: () => request<Array<{ id: string; name: string; email: string; role: string }>>("/auth/users"),
};

export const assets = {
  list: () =>
    request<{ success: boolean; data: Asset[] }>("/assets")
      .then((res) => res.data || []),

  get: (id: string) =>
    request<{ success: boolean; data: Asset }>(`/assets/${id}`)
      .then((res) => res.data),

  create: (data: Partial<Asset>) =>
    request<{ success: boolean; data: Asset }>("/assets", { 
      method: "POST", 
      body: JSON.stringify(data) 
    }).then((res) => res.data),

  update: (id: string, data: Partial<Asset>) =>
    request<{ success: boolean; data: Asset }>(`/assets/${id}`, { 
      method: "PUT", 
      body: JSON.stringify(data) 
    }).then((res) => res.data),

  remove: (id: string) =>
    request<{ message: string }>(`/assets/${id}`, { method: "DELETE" }),
};

export const allocations = {
  list: () => 
    request<{ success: boolean; data: Allocation[] }>("/allocations")
      .then((res) => res.data || []),

  get: (id: string) => 
    request<{ success: boolean; data: Allocation }>(`/allocations/${id}`)
      .then((res) => res.data),

  // REMAPPED CREATE FUNCTION HERE
  create: (data: { asset: string; user: string; allocationDate: string; remarks?: string }) => {
    const backendPayload = {
      assetId: data.asset,
      userId: data.user,
      allocationDate: data.allocationDate,
      remarks: data.remarks
    };

    return request<{ success: boolean; data: Allocation }>("/allocations", { 
      method: "POST", 
      body: JSON.stringify(backendPayload) // Sends assetId and userId now
    }).then((res) => res.data);
  },

  returnAsset: (id: string) =>
    request<{ success: boolean; data: Allocation }>(`/allocations/${id}/return`, { 
      method: "PATCH" 
    }).then((res) => res.data),

  remove: (id: string) =>
    request<{ message: string }>(`/allocations/${id}`, { method: "DELETE" }),
};

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("currentUser");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
  window.location.href = "/";
}