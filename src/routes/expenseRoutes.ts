import { Router } from 'express';
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

router.use(protect); 

router.route('/')
    .get(getExpenses)
    .post(createExpense);

router.get('/summary', getExpenseSummary);

router.route('/:expenseId')
    .get(getExpenseById)
    .put(updateExpense)
    .delete(deleteExpense);

export default router;