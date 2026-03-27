export interface BulkEntry {
  rowId?: string;
  platform?: string;
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
  notes?: string;
}

export class BulkCreateActualsDto {
  planId: string;
  periodLabel?: string;
  periodStart?: string;
  periodEnd?: string;
  entries: BulkEntry[];
}
