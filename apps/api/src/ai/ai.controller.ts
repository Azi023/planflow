import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { BudgetSuggestDto } from './dto/budget-suggest.dto';
import { SimilarCampaignsDto } from './dto/similar-campaigns.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /api/ai/budget-suggest
   * Given a campaign brief, returns Claude-generated platform budget allocation.
   */
  @Post('budget-suggest')
  @HttpCode(HttpStatus.OK)
  async budgetSuggest(@Body() dto: BudgetSuggestDto) {
    try {
      const result = await this.aiService.suggestBudgetAllocation(dto);
      return { success: true, data: result };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'AI service error';
      throw new HttpException(
        { success: false, error: message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/ai/similar-campaigns
   * Finds semantically similar past campaigns using Claude.
   */
  @Post('similar-campaigns')
  @HttpCode(HttpStatus.OK)
  async similarCampaigns(@Body() dto: SimilarCampaignsDto) {
    try {
      const result = await this.aiService.findSimilarCampaigns(dto);
      return { success: true, data: result };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'AI service error';
      throw new HttpException(
        { success: false, error: message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
