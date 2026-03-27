export class CreateActualDto {
  planId: string;
  rowId?: string;
  periodLabel?: string;
  periodStart?: string;
  periodEnd?: string;
  actualImpressions?: number;
  actualReach?: number;
  actualClicks?: number;
  actualEngagements?: number;
  actualVideoViews?: number;
  actualLeads?: number;
  actualLandingPageViews?: number;
  actualSpend?: number;
  actualCpm?: number;
  actualCpc?: number;
  actualCtr?: number;
  actualFrequency?: number;
  source?: 'manual' | 'bulk_paste' | 'api_import';
  notes?: string;
}
