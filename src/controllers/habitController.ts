import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { Habit, HabitInput, HabitCompletion, HabitCompletionInput, HabitFrequencyBE } from '../types/habitTypes';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'; 

export const getHabits = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' });
        return;
    }
    try {
        const [dbHabits] = await pool.query<RowDataPacket[]>(
            'SELECT id, userId, name, description, frequency, goal, color, icon, createdAt, updatedAt FROM Habits WHERE userId = ? ORDER BY createdAt DESC',
            [userId]
        );
        
        const habits: Habit[] = dbHabits.map(dbHabit => ({
           id: dbHabit.id,
           userId: dbHabit.userId,
           name: dbHabit.name,
           description: dbHabit.description,
           frequency: dbHabit.frequency as HabitFrequencyBE,
           goal: dbHabit.goal,
           color: dbHabit.color,
           icon: dbHabit.icon,
           createdAt: dbHabit.createdAt.toISOString(), 
           updatedAt: dbHabit.updatedAt.toISOString(), 
           completions: [], 
        }));
        res.status(200).json({ habits });
    } catch (error) {
        console.error('Error fetching habits:', error);
        res.status(500).json({ message: 'Server error while fetching habits.' });
    }
};

export const getHabitById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { habitId } = req.params;
    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' });
        return;
    }
    try {
        const [dbHabits] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM Habits WHERE id = ? AND userId = ?',
            [habitId, userId]
        );
        if (dbHabits.length === 0) {
            res.status(404).json({ message: 'Habit not found or not authorized.' });
            return;
        }
        const dbHabit = dbHabits[0];
        const [dbCompletions] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM HabitCompletions WHERE habitId = ? ORDER BY date DESC',
            [habitId]
        );

        const habit: Habit = {
           id: dbHabit.id,
           userId: dbHabit.userId,
           name: dbHabit.name,
           description: dbHabit.description,
           frequency: dbHabit.frequency as HabitFrequencyBE,
           goal: dbHabit.goal,
           color: dbHabit.color,
           icon: dbHabit.icon,
           createdAt: dbHabit.createdAt.toISOString(),
           updatedAt: dbHabit.updatedAt.toISOString(),
           completions: dbCompletions.map(comp => ({
               id: comp.id,
               habitId: comp.habitId,
               userId: comp.userId,
               date: comp.date.toISOString().split('T')[0], 
               notes: comp.notes,
               createdAt: comp.createdAt.toISOString(),
           })) as HabitCompletion[],
        };
        res.status(200).json({ habit });
    } catch (error) {
        console.error('Error fetching habit by ID:', error);
        res.status(500).json({ message: 'Server error while fetching habit.' });
    }
};

export const createHabit = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { name, description, frequency, goal, color, icon } = req.body as HabitInput;

    if (!userId) { res.status(401).json({ message: 'User not authenticated.' }); return; }
    if (!name || !frequency) {
        res.status(400).json({ message: 'Name and frequency are required.' }); return;
    }

    const habitId = uuidv4();
    const now = new Date();
    const newHabitDataForDb = {
        id: habitId, 
        userId, 
        name,
        description: description || null,
        frequency,
        goal: goal || null,
        color: color || null,
        icon: icon || null,
        createdAt: now, 
        updatedAt: now, 
    };

    try {
        await pool.query(
            'INSERT INTO Habits (id, userId, name, description, frequency, goal, color, icon, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
               newHabitDataForDb.id, newHabitDataForDb.userId, newHabitDataForDb.name,
               newHabitDataForDb.description, newHabitDataForDb.frequency, newHabitDataForDb.goal,
               newHabitDataForDb.color, newHabitDataForDb.icon, newHabitDataForDb.createdAt, newHabitDataForDb.updatedAt
            ]
        );

        
        const responseHabit: Habit = {
           id: habitId,
           userId: userId,
           name: name,
           description: description || undefined, 
           frequency: frequency,
           goal: goal || undefined,
           color: color || undefined,
           icon: icon || undefined,
           createdAt: now.toISOString(), 
           updatedAt: now.toISOString(), 
           completions: [], 
        };
        res.status(201).json({ message: 'Habit created successfully.', habit: responseHabit });
    } catch (error) {
        console.error('Error creating habit:', error);
        res.status(500).json({ message: 'Server error while creating habit.' });
    }
};

export const updateHabit = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { habitId } = req.params;
    const { name, description, frequency, goal, color, icon } = req.body as Partial<HabitInput>;
    if (!userId) { res.status(401).json({ message: 'User not authenticated.' }); return; }

    const updates: { [key: string]: any } = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description === '' ? null : description;
    if (frequency !== undefined) updates.frequency = frequency;
    if (goal !== undefined) updates.goal = goal === '' ? null : goal;
    if (color !== undefined) updates.color = color === '' ? null : color;
    if (icon !== undefined) updates.icon = icon === '' ? null : icon;

    if (Object.keys(updates).length === 0) {
        res.status(400).json({ message: 'No update fields provided.' }); return;
    }
    
    

    try {
        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE Habits SET ? WHERE id = ? AND userId = ?',
            [updates, habitId, userId]
        );
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Habit not found, not authorized, or no changes made.' }); return;
        }
        
        const [updatedHabitsResult] = await pool.query<RowDataPacket[]>('SELECT * FROM Habits WHERE id = ? AND userId = ?', [habitId, userId]);
        if (updatedHabitsResult.length === 0) {
           res.status(404).json({ message: 'Updated habit not found.' }); return;
        }
        const dbHabit = updatedHabitsResult[0];
        const [dbCompletions] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM HabitCompletions WHERE habitId = ? ORDER BY date DESC',
            [habitId]
        );
        const responseHabit: Habit = {
           id: dbHabit.id,
           userId: dbHabit.userId,
           name: dbHabit.name,
           description: dbHabit.description,
           frequency: dbHabit.frequency as HabitFrequencyBE,
           goal: dbHabit.goal,
           color: dbHabit.color,
           icon: dbHabit.icon,
           createdAt: dbHabit.createdAt.toISOString(),
           updatedAt: dbHabit.updatedAt.toISOString(),
           completions: dbCompletions.map(comp => ({
               id: comp.id,
               habitId: comp.habitId,
               userId: comp.userId,
               date: comp.date.toISOString().split('T')[0],
               notes: comp.notes,
               createdAt: comp.createdAt.toISOString(),
           })) as HabitCompletion[],
        };
        res.status(200).json({ message: 'Habit updated successfully.', habit: responseHabit });
    } catch (error) {
        console.error('Error updating habit:', error);
        res.status(500).json({ message: 'Server error while updating habit.' });
    }
};

export const deleteHabit = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { habitId } = req.params;
    if (!userId) { res.status(401).json({ message: 'User not authenticated.' }); return; }

    try {
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM Habits WHERE id = ? AND userId = ?',
            [habitId, userId]
        );
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Habit not found or not authorized.' }); return;
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting habit:', error);
        res.status(500).json({ message: 'Server error while deleting habit.' });
    }
};

export const toggleHabitCompletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { habitId } = req.params;
    const { date, notes } = req.body as HabitCompletionInput;

    if (!userId) { res.status(401).json({ message: 'User not authenticated.' }); return; }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { 
        res.status(400).json({ message: 'Valid date (YYYY-MM-DD) is required.' }); return;
    }

    try {
        const [habits] = await pool.query<RowDataPacket[]>('SELECT id FROM Habits WHERE id = ? AND userId = ?', [habitId, userId]);
        if (habits.length === 0) {
            res.status(404).json({ message: 'Habit not found or not authorized.' }); return;
        }

        const [existingCompletions] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM HabitCompletions WHERE habitId = ? AND date = ?',
            [habitId, date]
        );

        if (existingCompletions.length > 0) {
            const completionIdToDelete = existingCompletions[0].id;
            await pool.query('DELETE FROM HabitCompletions WHERE id = ?', [completionIdToDelete]);
            res.status(200).json({ message: 'Habit completion removed.', habitId, date, completed: false });
        } else {
            const completionId = uuidv4();
            const now = new Date();
            await pool.query(
                'INSERT INTO HabitCompletions (id, habitId, userId, date, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
                [completionId, habitId, userId, date, notes || null, now]
            );
            
            const newCompletionResponse: HabitCompletion = {
               id: completionId,
               habitId: habitId,
               userId: userId,
               date: date,
               notes: notes || undefined,
               createdAt: now.toISOString()
            };
            res.status(201).json({ message: 'Habit marked as completed.', completion: newCompletionResponse, completed: true });
        }
    } catch (error) {
        console.error('Error toggling habit completion:', error);
        if ((error as any).code === 'ER_DUP_ENTRY') { 
             res.status(409).json({ message: 'Habit completion toggle conflict. Please try again.' }); return;
        }
        res.status(500).json({ message: 'Server error while toggling habit completion.' });
    }
};

