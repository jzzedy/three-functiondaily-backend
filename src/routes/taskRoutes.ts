import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { protect, AuthenticatedRequest } from '../middleware/authMiddleware'; 
import {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask
} from '../controllers/taskController';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
router.use(protect as RequestHandler); 

router.route('/')
    .get(asyncHandler(getTasks as any)) 
    .post(asyncHandler(createTask as any));

router.route('/:taskId')
    .get(asyncHandler(getTaskById as any))
    .put(asyncHandler(updateTask as any))
    .delete(asyncHandler(deleteTask as any));

export default router;