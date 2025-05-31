import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/authMiddleware'; 
import { handleAiSuggestion } from '../controllers/aiController';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.post(
    '/suggestion', 
    protect as RequestHandler, 
    asyncHandler(handleAiSuggestion as (req: Request, res: Response, next: NextFunction) => Promise<void>)
);

export default router;
