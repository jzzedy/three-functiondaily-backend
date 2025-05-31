// src/controllers/authController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken'; 
import { v4 as uuidv4 } from 'uuid'; 
import pool from '../config/database';
import { User, UserWithPasswordHash } from '../types/userTypes';
import { RowDataPacket } from 'mysql2/promise'; 
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const JWT_SECRET_KEY: Secret = process.env.JWT_SECRET || 
    (process.env.NODE_ENV === 'production' ? (() => { throw new Error("JWT_SECRET not set in production for authController!"); })() : 'your-dev-fallback-secret-key-32-chars-long-for-auth');

// JWT_EXPIRES_IN will be a string like "7d" or a string representing number of seconds
const JWT_EXPIRES_IN_VALUE: string = process.env.JWT_EXPIRES_IN || '7d';

if (JWT_SECRET_KEY === 'your-dev-fallback-secret-key-32-chars-long-for-auth' && process.env.NODE_ENV !== 'test') {
    console.warn('WARNING: JWT_SECRET in authController is using a development fallback value. Please set a strong, unique secret in your .env file for production.');
}

const generateToken = (userId: string, email: string): string => {
    const payload = { userId, email };
    // The `expiresIn` option can be a string (e.g., "1h", "7d") or a number (seconds).
    // Since JWT_EXPIRES_IN_VALUE is a string, this should be acceptable by the library.
    // The type error is often due to overly strict @types/jsonwebtoken definitions or TS inference.
    // Using 'as any' here is a pragmatic way to bypass the type checker for this specific known-good case.
    const options: SignOptions = { expiresIn: JWT_EXPIRES_IN_VALUE as any }; 
    return jwt.sign(payload, JWT_SECRET_KEY, options);
};

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    const { email, password, username } = req.body;

    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required.' });
        return;
    }

    try {
        const [existingUsers] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM Users WHERE email = ?', [email]
        );

        if (existingUsers.length > 0) {
            res.status(409).json({ message: 'Email already in use.' });
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const userId = uuidv4();

        await pool.query(
            'INSERT INTO Users (id, email, passwordHash, username) VALUES (?, ?, ?, ?)',
            [userId, email, passwordHash, username || null]
        );

        const userResponse: User = { id: userId, email, username: username || null };
        const token = generateToken(userResponse.id, userResponse.email);

        res.status(201).json({ 
            message: 'User registered successfully.',
            user: userResponse, 
            token 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required.' });
        return;
    }

    try {
        const [users] = await pool.query<RowDataPacket[]>(
            'SELECT id, email, username, passwordHash FROM Users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            res.status(401).json({ message: 'Invalid credentials.' });
            return;
        }

        const userFromDb = users[0] as UserWithPasswordHash;
        const isMatch = await bcrypt.compare(password, userFromDb.passwordHash);

        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials.' });
            return;
        }

        const userResponse: User = { 
            id: userFromDb.id, 
            email: userFromDb.email, 
            username: userFromDb.username 
        };
        const token = generateToken(userResponse.id, userResponse.email);

        res.status(200).json({ 
            message: 'Login successful.',
            user: userResponse, 
            token 
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) { 
        res.status(401).json({ message: 'Not authorized, user data not available in request.' });
        return;
    }
    res.status(200).json({ user: req.user });
};
