export type ActivityType = 'call' | 'email' | 'mail' | 'meeting' | 'note';

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: 'admin' | 'member';
}

export interface Company {
  id: string;
  name: string;
  subscriptionStatus: 'active' | 'trial' | 'expired';
}

export interface AuthSession {
  user: User;
  company: Company;
}

// Individual phone with metadata
export interface PhoneContact {
  number: string;
  type: 'mobile' | 'landline' | 'unknown';
  doNotCall: boolean;
}

// Individual owner (supports up to 4)
export interface OwnerContact {
  firstName: string;
  lastName: string;
}

export interface Owner {
  // Legacy single name field for backward compatibility
  name: string;
  
  // Multiple owners (up to 4)
  owners?: OwnerContact[];
  
  // Multiple phones with DNC flags and types
  phones?: PhoneContact[];
  
  // Legacy single phone/email for backward compatibility
  email: string;
  phone: string;
  
  // Full mailing address (separate fields)
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  
  // Ownership metadata
  ownershipLengthMonths?: number;
  ownerType?: string; // "INDIVIDUAL", "TRUST", "INDIVIDUAL,TRUST"
  ownerOccupied?: boolean;
  
  // Compliance flags
  litigator?: boolean;
  
  // Contact info
  contactName?: string; // Primary contact name
  age?: number;
  
  // Existing
  notes?: string;
  lastVerifiedDate?: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  date: string;
  content: string;
  outcome?: string;
}

export interface MarketData {
  adr: number;
  occupancyRate: number;
  projectedRevenue: number;
  airbnbRating?: number;
  reviewCount?: number;
  propertyValue: number;
  monthlyRevenueDistribution?: number[];
}

export interface Property {
  id: string;
  companyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  guests?: number;
  squareFeet?: number;
  latitude?: number;
  longitude?: number;
  image: string;
  stageId: string;
  owner: Owner;
  activities: Activity[];
  tags: string[];
  marketData: MarketData;
  airbnbUrl?: string;
  zillowUrl?: string;
  propertyUrl?: string; // PropWire or other external link
  leadScore: number;
  customFields?: Record<string, any>;
}

export interface MarketingRequest {
  property: Property;
  tone: 'professional' | 'friendly' | 'urgent';
  format: 'email' | 'cold_call_script' | 'direct_mail';
}

export type FilterOperator = 
  | 'equals' 
  | 'contains' 
  | 'starts_with'
  | 'gt'
  | 'lt'
  | 'is_set' 
  | 'is_not_set'
  | 'is_true'
  | 'is_false';

export interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string | number;
}

export interface SavedList {
  id: string;
  name: string;
  rules: FilterRule[];
  matchType: 'and' | 'or';
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url' | 'email';

export interface FieldDefinition {
  id: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  isSystem: boolean;
  required?: boolean;
}

export interface ColumnDefinition {
  id: string;
  label: string;
  sortable: boolean;
  render?: (property: Property) => React.ReactNode;
}

export type ViewMode = 'properties' | 'owners' | 'kanban' | 'settings' | 'dashboard';
export type ListViewMode = 'table' | 'kanban';
