import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { protect } from '../middleware/authMiddleware';
import {
    getExpenses,
    getExpenseById,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseSummary
} from '../controllers/expenseController';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
router.use(protect as RequestHandler);

router.route('/')
    .get(asyncHandler(getExpenses as any))
    .post(asyncHandler(createExpense as any)); 

router.get('/summary', asyncHandler(getExpenseSummary as any));

router.route('/:expenseId')
    .get(asyncHandler(getExpenseById as any)) 
    .put(asyncHandler(updateExpense as any))
    .delete(asyncHandler(deleteExpense as any));

export default router;