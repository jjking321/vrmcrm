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

// Phone status for quality tracking
export type PhoneStatus = 'unknown' | 'verified' | 'wrong_number' | 'disconnected' | 'no_answer';

// Email status for quality tracking
export type EmailStatus = 'unknown' | 'verified' | 'bounced' | 'unsubscribed';

// Individual phone with metadata
export interface PhoneContact {
  number: string;
  type: 'mobile' | 'landline' | 'unknown';
  doNotCall: boolean;
  // Source tracking
  source?: string;        // List name or "manual"
  addedAt?: string;       // ISO timestamp
  // Quality tracking
  status?: PhoneStatus;
  lastCalledAt?: string;  // ISO timestamp
  callCount?: number;     // Total call attempts
  notes?: string;         // Optional notes
}

// Individual email with metadata
export interface EmailContact {
  address: string;
  type: 'personal' | 'work' | 'unknown';
  optedOut: boolean;
  // Source tracking
  source?: string;        // List name or "manual"
  addedAt?: string;       // ISO timestamp
  // Quality tracking
  status?: EmailStatus;
  lastVerifiedAt?: string; // ISO timestamp
}

// Individual owner (supports up to 4)
export interface OwnerContact {
  firstName: string;
  lastName: string;
  // Source tracking
  source?: string;        // List name or "manual"
  addedAt?: string;       // ISO timestamp
}

export interface Owner {
  // Legacy single name field for backward compatibility
  name: string;
  
  // Multiple owners (up to 4)
  owners?: OwnerContact[];
  
  // Multiple phones with DNC flags and types
  phones?: PhoneContact[];
  
  // Multiple emails with opt-out flags
  emails?: EmailContact[];
  
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
  createdBy?: string;
  createdByName?: string;
  ownerName?: string;       // The owner this activity is associated with
  propertyId?: string;      // The property this activity was regarding
  propertyAddress?: string; // Display-friendly property address
}

// Monthly performance metrics from AirROI
export interface MonthlyMetrics {
  date: string;        // "2024-01" format
  occupancy: number;
  averageDailyRate: number;
  revPar: number;
  revenue: number;
}

export interface MarketData {
  // Actual performance (from listing endpoint - only available if has Airbnb link)
  adr: number;
  occupancyRate: number;
  projectedRevenue: number;
  airbnbRating?: number;
  reviewCount?: number;
  
  // Market estimates (from comparable listings or calculator)
  marketAvgADR?: number;
  marketAvgOccupancy?: number;
  marketAvgRevenue?: number;
  comparableCount?: number;
  dataSource?: 'airroi_actuals' | 'airroi_projections';
  
  // Property value and other fields
  propertyValue: number;
  monthlyRevenueDistribution?: number[];
  
  // Monthly performance data (from /listings/metrics/all)
  monthlyMetrics?: MonthlyMetrics[];
  
  // Computed TTM rollup from monthly data
  ttmRevenue?: number;
  ttmAvgOccupancy?: number;
  ttmAvgADR?: number;
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
  yearBuilt?: number;
  lotSize?: number;
  propertyType?: string;
  latitude?: number;
  longitude?: number;
  image: string;
  stageId: string;
  owner: Owner;
  activities: Activity[];
  tags: string[];
  marketData: MarketData;
  airbnbUrl?: string;
  airbnbListingId?: string;
  zillowUrl?: string;
  propertyUrl?: string; // PropWire or other external link
  bookingLink?: string; // Generic booking link (VRBO, etc.)
  
  customFields?: Record<string, any>;
  // Scraped Airbnb data fields
  listingTitle?: string;
  roomType?: string;
  propertyManager?: string;
  host?: string;
}

export interface MarketingRequest {
  property: Property;
  tone: 'professional' | 'friendly' | 'urgent';
  format: 'email' | 'cold_call_script' | 'direct_mail';
}

export type FilterOperator = 
  | 'equals' 
  | 'not_equals'
  | 'contains' 
  | 'starts_with'
  | 'gt'
  | 'lt'
  | 'is_set' 
  | 'is_not_set'
  | 'is_true'
  | 'is_false'
  | 'any_of'
  | 'not_any_of';

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
  isHidden?: boolean;
  fieldKey?: string;
  required?: boolean;
}

export interface ColumnDefinition {
  id: string;
  label: string;
  sortable: boolean;
  render?: (property: Property) => React.ReactNode;
}

export interface Realtor {
  id: string;
  companyId: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  companyId: string;
  stageId: string;
  propertyId?: string;
  realtorId?: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  dealValue?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'properties' | 'owners' | 'kanban' | 'settings' | 'dashboard' | 'dataCleanup' | 'exclusions' | 'callLists' | 'dialer' | 'mailingLists' | 'realtors' | 'inbox';
export type ListViewMode = 'table' | 'kanban';

export type MailingListStatus = 'pending' | 'sent';

export interface MailingList {
  id: string;
  companyId: string;
  name: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  exportedAt?: string;
  exportCount: number;
}

export interface MailingListItem {
  id: string;
  mailingListId: string;
  propertyId: string;
  companyId: string;
  status: MailingListStatus;
  createdAt: string;
  sortOrder: number;
  // Joined data
  property?: Property;
}

export type CallOutcome = 'answered' | 'voicemail' | 'no_answer' | 'wrong_number' | 'callback' | 'dnc_skipped';
export type CallItemStatus = 'pending' | 'completed' | 'skipped';

export interface CallList {
  id: string;
  companyId: string;
  name: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallListItem {
  id: string;
  callListId: string;
  propertyId: string;
  companyId: string;
  ownerIndex: number | null;
  phoneIndex: number | null;
  status: CallItemStatus;
  callOutcome: CallOutcome | null;
  notes: string | null;
  lastCalledAt: string | null;
  callCount: number;
  callbackDate: string | null;
  sortOrder: number;
  createdAt: string;
  // Joined data
  property?: Property;
}

export interface ExclusionEntry {
  id: string;
  companyId: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  normalizedAddress?: string;
  source: 'manual' | 'import';
  notes?: string;
  createdAt: string;
}
