import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/authMiddleware'; 
import {
    getHabits,
    getHabitById,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion
} from '../controllers/habitController';

const router = Router();


const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.use(protect as RequestHandler); 

router.route('/')
    .get(asyncHandler(getHabits as any)) 
    .post(asyncHandler(createHabit as any));

router.route('/:habitId')
    .get(asyncHandler(getHabitById as any))
    .put(asyncHandler(updateHabit as any))
    .delete(asyncHandler(deleteHabit as any));

router.post('/:habitId/completions', asyncHandler(toggleHabitCompletion as any)); 

export default router;
