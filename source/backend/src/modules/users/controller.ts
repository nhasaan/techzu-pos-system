import type { Request, Response } from 'express';
import { success } from '../../shared/utils/response';
import type { CursorQuery } from '../../shared/utils/pagination';
import * as usersService from './service';
import type { CreateUserBody } from './validation';

export const usersController = {
  async list(req: Request, res: Response) {
    const { cursor, limit } = req.query as unknown as CursorQuery;
    res.json(success('OK', await usersService.listUsers(cursor, limit)));
  },

  async create(req: Request, res: Response) {
    const user = await usersService.createUser(req.body as CreateUserBody);
    req.log.info({ userId: user.id }, 'User created');
    res.status(201).json(success('User created', user));
  },
};
