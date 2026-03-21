export type UserRole = "SUPER_ADMIN" | "COMPANY" | "CUSTOMER";

export type MembershipType = "TRIAL" | "PLUS";

export type ListingType = "SERVICE" | "PRODUCT";

export interface RegisterCustomerRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  city?: string;
}

export interface RegisterCompanyRequest {
  email: string;
  password: string;
  companyName: string;
  taxNumber?: string;
  city?: string;
  sectors?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ListingCreateRequest {
  title: string;
  description: string;
  listingType: ListingType;
  sectorId: string;
  city: string;
  budgetMin?: number;
  budgetMax?: number;
  expiresAt?: string;
}

export interface BidCreateRequest {
  listingId: string;
  price: number;
  deliveryDay?: number;
  note?: string;
}

export interface TenderCreateRequest {
  listingId: string;
  startsAt: string;
  endsAt: string;
}

export interface TenderBidCreateRequest {
  tenderId: string;
  price: number;
  deliveryDay?: number;
  note?: string;
}
