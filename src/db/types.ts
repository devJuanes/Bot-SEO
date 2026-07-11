export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'discarded';

export interface Lead {
  id: string;
  external_id: string | null;
  source: string;
  name: string;
  business_type: string | null;
  description: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  needs_website: boolean;
  google_maps_url: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  latitude: number | null;
  longitude: number | null;
  status: LeadStatus | string;
  score: number | null;
  tags: string[] | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface LeadInsert {
  external_id?: string | null;
  source: string;
  name: string;
  business_type?: string | null;
  description?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  needs_website?: boolean;
  google_maps_url?: string | null;
  google_rating?: number | null;
  google_reviews_count?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  score?: number;
  tags?: string[];
  raw_data?: Record<string, unknown>;
}

export interface AgentRunInsert {
  agent_id: string;
  triggered_by: string;
  status: string;
  reason?: string | null;
  details?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string | null;
}
