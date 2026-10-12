import type { Request, Response } from 'express';
import { success } from '../../shared/utils/response';
import type { PaginationQuery } from '../../shared/utils/schemas';
import * as usersService from './service';
import type { CreateUserBody } from './validation';

export const usersController = {
  async list(req: Request, res: Response) {
    const { page, limit } = req.query as unknown as PaginationQuery;
    res.json(success('OK', await usersService.listUsers(page, limit)));
  },

  async create(req: Request, res: Response) {
    const user = await usersService.createUser(req.body as CreateUserBody);
    req.log.info({ userId: user.id }, 'User created');
    res.status(201).json(success('User created', user));
  },
};
