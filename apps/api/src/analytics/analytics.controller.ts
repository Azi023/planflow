import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('heatmap')
  getAccuracyHeatmap() {
    return this.analyticsService.getAccuracyHeatmap();
  }

  @Get('detail')
  getAccuracyDetail(
    @Query('platform') platform: string,
    @Query('objective') objective: string,
  ) {
    return this.analyticsService.getAccuracyDetail(platform, objective);
  }

  @Get('seasonal')
  getSeasonalAlerts(
    @Query('platform') platform?: string,
    @Query('objective') objective?: string,
    @Query('month') month?: string,
  ) {
    return this.analyticsService.getSeasonalAlerts(
      platform,
      objective,
      month ? Number(month) : undefined,
    );
  }

  @Get('trend')
  getMonthlyTrend(
    @Query('platform') platform: string,
    @Query('objective') objective: string,
  ) {
    return this.analyticsService.getMonthlyTrend(platform, objective);
  }
}
