import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { registerUser, loginUser, getCurrentUser } from '../controllers/authController';
import { protect, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.post('/register', asyncHandler(registerUser));
router.post('/login', asyncHandler(loginUser));

router.get('/me', protect as RequestHandler, asyncHandler(getCurrentUser as (req: Request, res: Response, next: NextFunction) => Promise<void>));

export default router;