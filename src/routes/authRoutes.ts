import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { registerUser, loginUser, getCurrentUser, requestPasswordReset, resetPassword, changePassword } from '../controllers/authController';
import { protect, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.post('/register', asyncHandler(registerUser));
router.post('/login', asyncHandler(loginUser));
router.get('/me', protect as RequestHandler, asyncHandler(getCurrentUser as any)); 
router.post('/request-password-reset', asyncHandler(requestPasswordReset as any));
router.post('/reset-password/:token', asyncHandler(resetPassword as any));
router.put('/change-password', protect as RequestHandler, asyncHandler(changePassword as any));

export default router;