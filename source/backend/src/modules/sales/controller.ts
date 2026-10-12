import type { Request, Response } from 'express';
import { assertOutletAccess, currentUser, isOutletUser } from '../../shared/utils/auth';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/utils/errors';
import { success } from '../../shared/utils/response';
import type { PaginationQuery } from '../../shared/utils/schemas';
import * as salesService from './service';
import { idempotencyKeySchema, type CreateSaleBody } from './validation';

export const salesController = {
  async create(req: Request, res: Response) {
    const user = currentUser(req);
    const body = req.body as CreateSaleBody;

    let outletId: number;
    if (isOutletUser(user)) {
      if (user.outletId == null) throw new ForbiddenError('Outlet user has no outlet');
      outletId = user.outletId;
    } else {
      if (body.outletId == null) throw new ValidationError('outletId required for HQ/superadmin', { outletId: 'Required' });
      outletId = body.outletId;
    }

    const keyResult = idempotencyKeySchema.safeParse(req.get('Idempotency-Key') || undefined);
    if (!keyResult.success) throw new ValidationError('Validation failed', { 'Idempotency-Key': keyResult.error.issues[0].message });

    const { replayed, ...result } = await salesService.createSale(outletId, body.items, {
      idempotencyKey: keyResult.data,
      userId: user.userId,
    });
    if (replayed) {
      res.setHeader('Idempotent-Replayed', 'true');
      res.json(success('Sale already processed', result));
      return;
    }
    req.log.info({ outletId, receiptNumber: result.receiptNumber, saleId: result.sale.id }, 'Sale created');
    res.status(201).json(success('Sale created', result));
  },

  async listByOutlet(req: Request, res: Response) {
    const { outletId } = req.params as unknown as { outletId: number };
    const { page, limit } = req.query as unknown as PaginationQuery;
    assertOutletAccess(currentUser(req), outletId);
    res.json(success('OK', await salesService.listByOutlet(outletId, page, limit)));
  },

  async getById(req: Request, res: Response) {
    const { saleId } = req.params as unknown as { saleId: number };
    const sale = await salesService.getSaleWithItems(saleId);
    if (!sale) throw new NotFoundError('Sale not found', { saleId: 'Not found' });
    const user = currentUser(req);
    if (isOutletUser(user) && user.outletId !== sale.outletId) throw new ForbiddenError('Access denied.');
    res.json(success('OK', sale));
  },
};
