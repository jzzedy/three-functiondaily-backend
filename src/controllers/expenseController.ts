import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { Expense, ExpenseInput } from '../types/expenseTypes';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'; 

export const getExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' });
        return;
    }

    try {
        const [expenses] = await pool.query<RowDataPacket[]>( 
            'SELECT * FROM Expenses WHERE userId = ? ORDER BY date DESC, createdAt DESC',
            [userId]
        );
        res.status(200).json({ expenses });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'Server error while fetching expenses.' });
    }
};

export const getExpenseById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { expenseId } = req.params;
    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' });
        return;
    }

    try {
        const [expenses] = await pool.query<RowDataPacket[]>( 
            'SELECT * FROM Expenses WHERE id = ? AND userId = ?',
            [expenseId, userId]
        );
        if (expenses.length === 0) {
            res.status(404).json({ message: 'Expense not found or not authorized.' });
            return;
        }
        res.status(200).json({ expense: expenses[0] as Expense });
    } catch (error) {
        console.error('Error fetching expense by ID:', error);
        res.status(500).json({ message: 'Server error while fetching expense.' });
    }
};


export const createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { description, amount, category, date } = req.body as ExpenseInput;

    if (!userId) { res.status(401).json({ message: 'User not authenticated.' }); return; }
    if (!description || amount === undefined || !category || !date) {
        res.status(400).json({ message: 'Description, amount, category, and date are required.' }); return;
    }
    if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({ message: 'Amount must be a positive number.' }); return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
         res.status(400).json({ message: 'Date must be in YYYY-MM-DD format.' }); return;
    }

    const expenseId = uuidv4();
    try {
        await pool.query(
            'INSERT INTO Expenses (id, userId, description, amount, category, date) VALUES (?, ?, ?, ?, ?, ?)',
            [expenseId, userId, description, amount, category, date]
        );
        const [createdExpenses] = await pool.query<RowDataPacket[]>('SELECT * FROM Expenses WHERE id = ?', [expenseId]); 
        res.status(201).json({ message: 'Expense created successfully.', expense: createdExpenses[0] as Expense });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ message: 'Server error while creating expense.' });
    }
};


export const updateExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { expenseId } = req.params;
    const { description, amount, category, date } = req.body as Partial<ExpenseInput>;

    if (!userId) { res.status(401).json({ message: 'User not authenticated.' }); return; }

    const updates: { [key: string]: any } = {};
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) {
        if (typeof amount !== 'number' || amount <= 0) {
            res.status(400).json({ message: 'Amount must be a positive number.' }); return;
        }
        updates.amount = amount;
    }
    if (category !== undefined) updates.category = category;
    if (date !== undefined) {
         if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.status(400).json({ message: 'Date must be in YYYY-MM-DD format.' }); return;
        }
        updates.date = date;
    }

    if (Object.keys(updates).length === 0) {
        res.status(400).json({ message: 'No update fields provided.' }); return;
    }
    updates.updatedAt = new Date();

    try {
        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE Expenses SET ? WHERE id = ? AND userId = ?',
            [updates, expenseId, userId]
        );
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Expense not found, not authorized, or no changes made.' }); return;
        }
        const [updatedExpenses] = await pool.query<RowDataPacket[]>('SELECT * FROM Expenses WHERE id = ?', [expenseId]); 
        res.status(200).json({ message: 'Expense updated successfully.', expense: updatedExpenses[0] as Expense });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ message: 'Server error while updating expense.' });
    }
};


export const deleteExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { expenseId } = req.params;
    if (!userId) { res.status(401).json({ message: 'User not authenticated.' }); return; }

    try {
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM Expenses WHERE id = ? AND userId = ?',
            [expenseId, userId]
        );
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Expense not found or not authorized.' }); return;
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ message: 'Server error while deleting expense.' });
    }
};


export const getExpenseSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ message: 'User not authenticated.' }); return; }

    try {
        const [summaryRows] = await pool.query<RowDataPacket[]>( 
            `SELECT category, SUM(amount) as totalAmount 
             FROM Expenses 
             WHERE userId = ? 
             GROUP BY category 
             ORDER BY totalAmount DESC`,
            [userId]
        );

        const [totalOverallResult] = await pool.query<RowDataPacket[]>( 
            'SELECT SUM(amount) as grandTotal FROM Expenses WHERE userId = ?',
            [userId]
        );

        const summary = summaryRows.map(row => ({
            category: row.category,
            totalAmount: parseFloat(row.totalAmount) 
        }));
        const grandTotal = totalOverallResult[0]?.grandTotal ? parseFloat(totalOverallResult[0].grandTotal) : 0;

        res.status(200).json({ summary, grandTotal });
    } catch (error) {
        console.error('Error fetching expense summary:', error);
        res.status(500).json({ message: 'Server error while fetching expense summary.' });
    }
};