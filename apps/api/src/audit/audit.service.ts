import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(
    action: string,
    entityType: string,
    entityId: string | null,
    userId: string | null,
    metadata: Record<string, unknown> = {},
    ipAddress?: string,
    userEmail?: string,
  ): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          action,
          entityType,
          entityId,
          userId,
          userEmail: userEmail ?? null,
          metadata,
          ipAddress: ipAddress ?? null,
        }),
      );
    } catch {
      // Audit logging must never break the main flow
    }
  }

  async findAll(opts: {
    page?: number;
    limit?: number;
    entityType?: string;
    action?: string;
    userId?: string;
    entityId?: string;
    from?: string;
    to?: string;
  } = {}): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));

    const qb = this.auditRepo
      .createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (opts.entityType) {
      qb.andWhere('log.entity_type = :entityType', {
        entityType: opts.entityType,
      });
    }
    if (opts.action) {
      qb.andWhere('log.action = :action', { action: opts.action });
    }
    if (opts.userId) {
      qb.andWhere('log.user_id = :userId', { userId: opts.userId });
    }
    if (opts.entityId) {
      qb.andWhere('log.entity_id = :entityId', { entityId: opts.entityId });
    }
    if (opts.from) {
      qb.andWhere('log.created_at >= :from', { from: opts.from });
    }
    if (opts.to) {
      qb.andWhere('log.created_at <= :to', { to: opts.to });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
