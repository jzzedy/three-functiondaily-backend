import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { Task, TaskInput } from '../types/taskTypes';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export const getTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' });
        return;
    }
    try {
        const [tasks] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM Tasks WHERE userId = ? ORDER BY createdAt DESC',
            [userId]
        );
        res.status(200).json({ tasks });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks.' });
    }
};

export const getTaskById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { taskId } = req.params;

    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' });
        return;
    }

    try {
        const [tasks] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM Tasks WHERE id = ? AND userId = ?',
            [taskId, userId]
        );
        if (tasks.length === 0) {
            res.status(404).json({ message: 'Task not found or not authorized.' });
            return;
        }
        res.status(200).json({ task: tasks[0] as Task });
    } catch (error) {
        console.error('Error fetching task by ID:', error);
        res.status(500).json({ message: 'Server error while fetching task.' });
    }
};


export const createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { title, description, deadline, category } = req.body as TaskInput;

    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' });
        return;
    }
    if (!title) {
        res.status(400).json({ message: 'Title is required.' });
        return;
    }

    const taskId = uuidv4();
    const newTaskData = { 
        id: taskId,
        userId,
        title,
        description: description || null,
        deadline: deadline || null,
        category: category || null,
        isCompleted: false, 
    };

    try {
        await pool.query(
            'INSERT INTO Tasks (id, userId, title, description, deadline, category, isCompleted) VALUES (?, ?, ?, ?, ?, ?, ?)',
            Object.values(newTaskData)
        );

        const [createdTasks] = await pool.query<RowDataPacket[]>('SELECT * FROM Tasks WHERE id = ?', [taskId]);

        res.status(201).json({ message: 'Task created successfully.', task: createdTasks[0] as Task });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Server error while creating task.' });
    }
};


export const updateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { taskId } = req.params;
    const { title, description, deadline, category, isCompleted } = req.body as Partial<TaskInput>;

    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' });
        return;
    }

    const updates: { [key: string]: any } = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description === '' ? null : description;
    if (deadline !== undefined) updates.deadline = deadline === '' ? null : deadline;
    if (category !== undefined) updates.category = category === '' ? null : category;
    if (isCompleted !== undefined) updates.isCompleted = isCompleted;

    if (Object.keys(updates).length === 0) {
        res.status(400).json({ message: 'No update fields provided.' });
        return;
    }
    updates.updatedAt = new Date();

    try {
        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE Tasks SET ? WHERE id = ? AND userId = ?',
            [updates, taskId, userId]
        );

        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Task not found, not authorized, or no changes made.' });
            return;
        }

        const [updatedTasks] = await pool.query<RowDataPacket[]>('SELECT * FROM Tasks WHERE id = ?', [taskId]);
        res.status(200).json({ message: 'Task updated successfully.', task: updatedTasks[0] as Task });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Server error while updating task.' });
    }
};


export const deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { taskId } = req.params;

    if (!userId) {
        res.status(401).json({ message: 'User not authenticated.' });
        return;
    }

    try {
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM Tasks WHERE id = ? AND userId = ?',
            [taskId, userId]
        );

        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Task not found or not authorized.' });
            return;
        }
        res.status(204).send(); 
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Server error while deleting task.' });
    }
};
