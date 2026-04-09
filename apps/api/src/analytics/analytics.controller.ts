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
  async getSeasonalAlerts(
    @Query('platform') platform?: string,
    @Query('objective') objective?: string,
    @Query('month') month?: string,
  ) {
    const data = await this.analyticsService.getSeasonalAlerts(
      platform,
      objective,
      month ? Number(month) : undefined,
    );
    return {
      data,
      message: data.length === 0
        ? 'Requires plan-linked actuals with period dates for seasonal analysis. Import actuals with period_start dates to enable this feature.'
        : undefined,
    };
  }

  @Get('trend')
  async getMonthlyTrend(
    @Query('platform') platform: string,
    @Query('objective') objective: string,
  ) {
    const data = await this.analyticsService.getMonthlyTrend(
      platform,
      objective,
    );
    return {
      data,
      message: data.length === 0
        ? 'Requires plan-linked actuals with CPM data for trend analysis. At least 3 months of data needed.'
        : undefined,
    };
  }
}
