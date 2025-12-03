import { Property, PipelineStage, FieldDefinition } from '@/types';

export const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'lead-list', name: 'Lead List', color: 'slate' },
  { id: 'contacted', name: 'Contacted', color: 'blue' },
  { id: 'meeting-scheduled', name: 'Meeting Scheduled', color: 'amber' },
  { id: 'proposal-sent', name: 'Proposal Sent', color: 'violet' },
  { id: 'negotiating', name: 'Negotiating', color: 'cyan' },
  { id: 'contract-signed', name: 'Contract Signed', color: 'emerald' },
];

export const SYSTEM_FIELDS: FieldDefinition[] = [
  { id: 'address', label: 'Address', type: 'text', isSystem: true },
  { id: 'city', label: 'City', type: 'text', isSystem: true },
  { id: 'state', label: 'State', type: 'text', isSystem: true },
  { id: 'zip', label: 'Zip', type: 'text', isSystem: true },
  { id: 'bedrooms', label: 'Beds', type: 'number', isSystem: true },
  { id: 'bathrooms', label: 'Baths', type: 'number', isSystem: true },
  { id: 'stageId', label: 'Stage', type: 'select', isSystem: true },
  { id: 'leadScore', label: 'Lead Score', type: 'number', isSystem: true },
  { id: 'estimatedRevenue', label: 'Est. Revenue', type: 'number', isSystem: true },
  { id: 'tags', label: 'Tags', type: 'text', isSystem: true },
  { id: 'ownerName', label: 'Owner', type: 'text', isSystem: true },
  { id: 'lastActivity', label: 'Last Activity', type: 'date', isSystem: true },
  { id: 'ownershipLength', label: 'Ownership Length', type: 'number', isSystem: true },
  { id: 'ownerType', label: 'Owner Type', type: 'text', isSystem: true },
  { id: 'ownerOccupied', label: 'Owner Occupied', type: 'checkbox', isSystem: true },
  { id: 'litigator', label: 'Litigator', type: 'checkbox', isSystem: true },
  { id: 'hasDNC', label: 'Has DNC Phone', type: 'checkbox', isSystem: true },
];

export const MOCK_PROPERTIES: Property[] = [
  {
    id: '1',
    companyId: 'default',
    address: '123 Oceanview Drive',
    city: 'Destin',
    state: 'FL',
    zip: '32541',
    bedrooms: 4,
    bathrooms: 3,
    guests: 10,
    squareFeet: 2500,
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    stageId: 'lead-list',
    tags: ['beachfront', 'luxury', 'pool'],
    owner: {
      name: 'Sarah Johnson',
      owners: [
        { firstName: 'Sarah', lastName: 'Johnson' },
        { firstName: 'Michael', lastName: 'Johnson' }
      ],
      phones: [
        { number: '850-555-0123', type: 'mobile', doNotCall: false },
        { number: '850-555-0124', type: 'landline', doNotCall: true }
      ],
      email: 'sarah.johnson@email.com',
      phone: '850-555-0123',
      mailingAddress: '456 Inland Ave',
      mailingCity: 'Pensacola',
      mailingState: 'FL',
      mailingZip: '32501',
      ownershipLengthMonths: 48,
      ownerType: 'INDIVIDUAL',
      ownerOccupied: false,
      litigator: false,
      lastVerifiedDate: new Date().toISOString(),
    },
    activities: [
      { id: 'a1', type: 'email', date: new Date(Date.now() - 86400000 * 2).toISOString(), content: 'Sent initial outreach email', outcome: 'Awaiting response' },
    ],
    marketData: {
      adr: 450,
      occupancyRate: 72,
      projectedRevenue: 118260,
      airbnbRating: 4.8,
      reviewCount: 45,
      propertyValue: 1250000,
      monthlyRevenueDistribution: [5, 6, 8, 10, 14, 16, 15, 14, 8, 4, 3, 5]
    },
    airbnbUrl: 'https://airbnb.com/rooms/123',
    propertyUrl: 'https://propwire.com/property/123',
    leadScore: 85
  },
  {
    id: '2',
    companyId: 'default',
    address: '789 Mountain View Lane',
    city: 'Gatlinburg',
    state: 'TN',
    zip: '37738',
    bedrooms: 6,
    bathrooms: 4,
    guests: 14,
    squareFeet: 3200,
    image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&h=600&fit=crop',
    stageId: 'contacted',
    tags: ['mountain', 'cabin', 'hot-tub'],
    owner: {
      name: 'Michael Chen',
      owners: [{ firstName: 'Michael', lastName: 'Chen' }],
      phones: [
        { number: '865-555-0456', type: 'mobile', doNotCall: false }
      ],
      email: 'mchen@business.net',
      phone: '865-555-0456',
      ownershipLengthMonths: 120,
      ownerType: 'TRUST',
      ownerOccupied: false,
      litigator: true, // Example litigator
      lastVerifiedDate: new Date(Date.now() - 86400000 * 15).toISOString(),
    },
    activities: [
      { id: 'a2', type: 'call', date: new Date(Date.now() - 86400000 * 5).toISOString(), content: 'Left voicemail regarding management services' },
      { id: 'a3', type: 'email', date: new Date(Date.now() - 86400000 * 3).toISOString(), content: 'Follow-up email with revenue projections', outcome: 'Opened, no reply' },
    ],
    marketData: {
      adr: 380,
      occupancyRate: 68,
      projectedRevenue: 94300,
      airbnbRating: 4.6,
      reviewCount: 89,
      propertyValue: 850000,
      monthlyRevenueDistribution: [8, 7, 9, 8, 7, 10, 12, 11, 9, 10, 11, 8]
    },
    leadScore: 72
  },
  {
    id: '3',
    companyId: 'default',
    address: '456 Palm Beach Blvd',
    city: 'Miami Beach',
    state: 'FL',
    zip: '33139',
    bedrooms: 2,
    bathrooms: 2,
    guests: 6,
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
    stageId: 'meeting-scheduled',
    tags: ['condo', 'urban', 'ocean-view'],
    owner: {
      name: 'Robert Martinez',
      owners: [
        { firstName: 'Robert', lastName: 'Martinez' },
        { firstName: 'Elena', lastName: 'Martinez' },
        { firstName: 'Carlos', lastName: 'Martinez' }
      ],
      phones: [
        { number: '305-555-0789', type: 'mobile', doNotCall: false },
        { number: '305-555-0790', type: 'mobile', doNotCall: false },
        { number: '305-555-0791', type: 'landline', doNotCall: true }
      ],
      email: 'rmartinez@gmail.com',
      phone: '305-555-0789',
      mailingAddress: '100 Biscayne Blvd #1502',
      mailingCity: 'Miami',
      mailingState: 'FL',
      mailingZip: '33132',
      ownershipLengthMonths: 36,
      ownerType: 'INDIVIDUAL,TRUST',
      ownerOccupied: true,
      litigator: false,
      lastVerifiedDate: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    activities: [
      { id: 'a4', type: 'meeting', date: new Date(Date.now() + 86400000 * 2).toISOString(), content: 'Zoom meeting scheduled to discuss terms' },
    ],
    marketData: {
      adr: 320,
      occupancyRate: 78,
      projectedRevenue: 91100,
      airbnbRating: 4.9,
      reviewCount: 156,
      propertyValue: 680000,
      monthlyRevenueDistribution: [10, 10, 12, 9, 7, 6, 7, 7, 6, 8, 9, 9]
    },
    airbnbUrl: 'https://airbnb.com/rooms/456',
    leadScore: 90
  },
  {
    id: '4',
    companyId: 'default',
    address: '321 Lakefront Circle',
    city: 'Lake Tahoe',
    state: 'CA',
    zip: '96150',
    bedrooms: 5,
    bathrooms: 3,
    guests: 12,
    squareFeet: 2800,
    image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=600&fit=crop',
    stageId: 'proposal-sent',
    tags: ['lakefront', 'ski-in', 'premium'],
    owner: {
      name: 'Jennifer Williams',
      owners: [{ firstName: 'Jennifer', lastName: 'Williams' }],
      phones: [
        { number: '530-555-0234', type: 'mobile', doNotCall: false }
      ],
      email: 'jwilliams@outlook.com',
      phone: '530-555-0234',
      ownershipLengthMonths: 84,
      ownerType: 'INDIVIDUAL',
      ownerOccupied: false,
      litigator: false,
      lastVerifiedDate: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    activities: [
      { id: 'a5', type: 'mail', date: new Date(Date.now() - 86400000 * 10).toISOString(), content: 'Sent physical welcome packet' },
      { id: 'a6', type: 'email', date: new Date(Date.now() - 86400000).toISOString(), content: 'Sent management proposal PDF', outcome: 'Under review' },
    ],
    marketData: {
      adr: 520,
      occupancyRate: 65,
      projectedRevenue: 123370,
      airbnbRating: 4.7,
      reviewCount: 67,
      propertyValue: 1450000,
      monthlyRevenueDistribution: [12, 10, 8, 5, 4, 6, 8, 7, 5, 6, 14, 15]
    },
    leadScore: 78
  },
  {
    id: '5',
    companyId: 'default',
    address: '555 Downtown Loft Ave',
    city: 'Nashville',
    state: 'TN',
    zip: '37203',
    bedrooms: 1,
    bathrooms: 1,
    guests: 4,
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
    stageId: 'lead-list',
    tags: ['condo', 'urban', 'downtown'],
    owner: {
      name: 'John Smith',
      owners: [{ firstName: 'John', lastName: 'Smith' }],
      phones: [
        { number: '615-555-0123', type: 'landline', doNotCall: true } // All phones DNC
      ],
      email: 'john.smith@example.com',
      phone: '615-555-0123',
      mailingAddress: '450 Main St',
      mailingCity: 'Nashville',
      mailingState: 'TN',
      mailingZip: '37201',
      ownershipLengthMonths: 24,
      ownerType: 'INDIVIDUAL',
      ownerOccupied: true,
      litigator: false,
      lastVerifiedDate: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    activities: [],
    marketData: {
      adr: 220,
      occupancyRate: 85,
      projectedRevenue: 68255,
      airbnbRating: 4.5,
      reviewCount: 10,
      propertyValue: 450000
    },
    airbnbUrl: 'https://airbnb.com/rooms/789',
    leadScore: 60
  }
];

export const DEFAULT_COLUMNS = ['address', 'city', 'state', 'stageId', 'leadScore', 'estimatedRevenue', 'tags', 'ownerName'];
