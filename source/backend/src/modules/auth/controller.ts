import type { Request, Response } from 'express';
import { currentUser } from '../../shared/utils/auth';
import { success } from '../../shared/utils/response';
import * as authService from './service';
import type { LoginBody, RefreshBody } from './validation';

export const authController = {
  async login(req: Request, res: Response) {
    const { username, password } = req.body as LoginBody;
    const tokens = await authService.login(username, password);
    req.log.info({ username }, 'Login success');
    res.json(success('Login successful', tokens));
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body as RefreshBody;
    res.json(success('Token refreshed', await authService.refresh(refreshToken)));
  },

  async logout(req: Request, res: Response) {
    const user = currentUser(req);
    await authService.logout(user.jti, user.exp);
    req.log.info({ userId: user.userId }, 'Logout success');
    res.json(success('Logged out successfully', null));
  },
};
