export type Role = 'BUYER' | 'SELLER' | 'ADMIN' | 'GOVERNMENT_OFFICER' | 'SURVEYOR';

export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: string;
  nationalId?: string;
  avatarUrl?: string;
  twoFactorEnabled: boolean;
  isBlacklisted: boolean;
  permissions: string[];
  createdAt: string;
}

export interface Parcel {
  id: string;
  parcelNumber: string;
  titleDeedNumber: string;
  county: string;
  subCounty: string;
  locality: string;
  sizeAcres: number;
  landUse: string;
  price: number;
  currency: string;
  description: string;
  latitude?: number;
  longitude?: number;
  status: string;
  riskScore: number;
  featuredImage?: string;
  sellerId: string;
  currentOwnerId?: string;
  seller?: { id: string; firstName: string; lastName: string; email: string; isBlacklisted?: boolean };
  currentOwner?: { id: string; firstName: string; lastName: string };
  documents?: Document[];
  verifications?: Verification[];
  fraudFlags?: FraudFlag[];
  ownershipHistory?: any[];
  qrCodes?: { code: string; type: string }[];
  _count?: { fraudFlags: number; transactions: number };
  createdAt: string;
}

export interface Document {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  status: string;
  rejectionReason?: string;
  expiryDate?: string;
  createdAt: string;
}

export interface Verification {
  id: string;
  stage: string;
  status: string;
  notes?: string;
  decidedAt?: string;
  createdAt: string;
  reviewer?: { firstName: string; lastName: string; role: string };
}

export interface FraudFlag {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  description: string;
  resolved: boolean;
  createdAt: string;
  parcel?: { parcelNumber: string; county: string; riskScore: number };
}

export interface Transaction {
  id: string;
  reference: string;
  offerAmount: number;
  status: string;
  createdAt: string;
  parcel?: Parcel;
  buyer?: { id: string; firstName: string; lastName: string; email: string };
  seller?: { id: string; firstName: string; lastName: string; email: string };
  payments?: any[];
  certificate?: { certificateNumber: string; issuedAt: string };
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: { total: number; page: number; pageSize: number; pages: number };
}
