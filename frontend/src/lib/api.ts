import { clearSession, handleUnauthorized } from "./session";
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
  if (path !== "/auth/login") handleUnauthorized(res.status, token);
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
  role: "Admin" | "IT Staff" | "Employee";
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
  serialNumber?: string;
  purchaseDate: string;
}

export interface AssetQRCode {
  _id: string;
  asset: Asset;
  token: string;
  qrValue: string;
  imageUrl: string;
  imageDataUrl?: string;
  generatedAt: string;
  scanCount: number;
  lastScannedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Allocation {
  _id: string;
  asset: Asset;
  employee?: Employee | null;
  user?: User | null; // Unmapped legacy assignments remain readable and returnable.
  allocationDate: string;
  returnDate?: string;
  allocationStatus: "Allocated" | "Returned" | "Pending";
  remarks?: string;
}

export interface License {
  _id: string;
  softwareName: string;
  vendor: string;
  licenseKey: string;
  licenseType: "Perpetual" | "Subscription" | "Trial" | "Open Source" | null;
  numberOfSeats: number;
  assignedSeats: number;
  purchaseDate?: string;
  expiryDate?: string;
  cost: number | null;
  status: "Active" | "Expired" | "Expiring Soon" | "Suspended";
  notes?: string;
  createdAt: string;
}

export interface MaintenanceRecord {
  _id: string;
  asset: string | Asset;
  maintenanceType: "Preventive" | "Corrective" | "Repair" | "Upgrade" | "Inspection" | "Replacement" | "Cleaning";
  description: string;
  serviceProvider?: string;
  maintenanceDate: string;
  nextMaintenanceDate?: string;
  cost: number;
  status: "Scheduled" | "In Progress" | "Completed" | "Cancelled";
}
export interface Employee {
  _id: string;
  fullName: string;
  employeeId: string;
  email: string;
  department: string;
  designation: string;
  phone?: string;
  status: "Active" | "Inactive";
  createdAt?: string;
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
  getAllUsers: () => request<Array<{ _id: string; id: string; fullName: string; name: string; email: string; role: string; isActive: boolean }>>("/auth/users"),
  updateUser: (id: string, changes: { fullName: string; email: string; role: string }) =>
    request<{ user: User }>(`/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  updateAccess: (id: string, changes: { isActive?: boolean; revokeSessions?: true }) =>
    request<{ user: User }>(`/auth/users/${id}/access`, {
      method: "PATCH", body: JSON.stringify(changes),
    }),
  getAssignees: () => request<Array<{ id: string; name: string }>>("/auth/assignees"),
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

export const qrCodes = {
  // Images need the same bearer authentication as JSON requests.
  image: async (assetId: string) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/qr/assets/${assetId}/image`, {
      headers: { Authorization: `Bearer ${token || ""}` },
    });
    handleUnauthorized(res.status, token);
    if (!res.ok) throw new Error("Could not load QR image.");
    return URL.createObjectURL(await res.blob());
  },
  list: () =>
    request<{ success: boolean; data: AssetQRCode[] }>("/qr")
      .then((res) => res.data || []),

  generate: (assetId: string, regenerate = false) =>
    request<{ success: boolean; data: AssetQRCode }>(`/qr/assets/${assetId}/generate`, {
      method: "POST",
      body: JSON.stringify({ regenerate }),
    }).then((res) => res.data),

  scan: (code: string) =>
    request<{ success: boolean; data: AssetQRCode }>("/qr/scan", {
      method: "POST",
      body: JSON.stringify({ code }),
    }).then((res) => res.data),

  updateStatus: (code: string, status: Asset["status"]) =>
    request<{ success: boolean; data: AssetQRCode }>("/qr/status", {
      method: "PATCH",
      body: JSON.stringify({ code, status }),
    }).then((res) => res.data),
};

export const allocations = {
  list: () => 
    request<{ success: boolean; data: Allocation[] }>("/allocations")
      .then((res) => res.data || []),

  get: (id: string) => 
    request<{ success: boolean; data: Allocation }>(`/allocations/${id}`)
      .then((res) => res.data),

  create: (data: { asset: string; employee: string; allocationDate: string; remarks?: string }) => {
    const backendPayload = {
      assetId: data.asset,
      employeeId: data.employee,
      allocationDate: data.allocationDate,
      remarks: data.remarks
    };

    return request<{ success: boolean; data: Allocation }>("/allocations", { 
      method: "POST", 
      body: JSON.stringify(backendPayload)
    }).then((res) => res.data);
  },

  returnAsset: (id: string) =>
    request<{ success: boolean; data: Allocation }>(`/allocations/${id}/return`, { 
      method: "PATCH" 
    }).then((res) => res.data),

  remove: (id: string) =>
    request<{ message: string }>(`/allocations/${id}`, { method: "DELETE" }),
};
export const licenses = {
  list: () =>
    request<{ success: boolean; data: License[] }>("/licenses").then((res) => res.data || []),
  get: (id: string) =>
    request<{ success: boolean; data: License }>(`/licenses/${id}`).then((res) => res.data),
  create: (data: Partial<License>) =>
    request<{ success: boolean; data: License }>("/licenses", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => res.data),
  update: (id: string, data: Partial<License>) =>
    request<{ success: boolean; data: License }>(`/licenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((res) => res.data),
  remove: (id: string) =>
    request<{ message: string }>(`/licenses/${id}`, { method: "DELETE" }),
};

export const maintenance = {
  list: () =>
    request<{ success: boolean; data: MaintenanceRecord[] }>("/maintenance").then((res) => res.data || []),
  get: (id: string) =>
    request<{ success: boolean; data: MaintenanceRecord }>(`/maintenance/${id}`).then((res) => res.data),
  create: (data: Partial<MaintenanceRecord> & { asset: string }) =>
    request<{ success: boolean; data: MaintenanceRecord }>("/maintenance", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => res.data),
  update: (id: string, data: Partial<MaintenanceRecord>) =>
    request<{ success: boolean; data: MaintenanceRecord }>(`/maintenance/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((res) => res.data),
  remove: (id: string) =>
    request<{ message: string }>(`/maintenance/${id}`, { method: "DELETE" }),
};

export const employees = {
  assignees: () => request<{ success: boolean; data: Array<Pick<Employee, "_id" | "fullName" | "employeeId">> }>("/employees/assignees")
    .then(res => res.data),
  list: () =>
    request<{ success: boolean; data: Employee[] }>("/employees")
      .then((res) => res.data || []),

  get: (id: string) =>
    request<{ success: boolean; data: Employee }>(`/employees/${id}`)
      .then((res) => res.data),

  create: (data: Partial<Employee>) =>
    request<{ success: boolean; data: Employee }>("/employees", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => res.data),

  update: (id: string, data: Partial<Employee>) =>
    request<{ success: boolean; data: Employee }>(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((res) => res.data),

  remove: (id: string) =>
    request<{ success: boolean; message: string }>(`/employees/${id}`, {
      method: "DELETE",
    }),
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
  clearSession();
}
