import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken'; 
import { v4 as uuidv4 } from 'uuid'; 
import crypto from 'crypto';
import pool from '../config/database';
import { User, UserWithPasswordHash } from '../types/userTypes';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'; 
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const JWT_SECRET_KEY: Secret = process.env.JWT_SECRET || 
    (process.env.NODE_ENV === 'production' ? (() => { throw new Error("JWT_SECRET not set in production for authController!"); })() : 'your-dev-fallback-secret-key-32-chars-long-for-auth');

const JWT_EXPIRES_IN_VALUE: string = process.env.JWT_EXPIRES_IN || '7d';

if (JWT_SECRET_KEY === 'your-dev-fallback-secret-key-32-chars-long-for-auth' && process.env.NODE_ENV !== 'test') {
    console.warn('WARNING: JWT_SECRET in authController is using a development fallback value. Please set a strong, unique secret in your .env file for production.');
}

const generateToken = (userId: string, email: string): string => {
    const payload = { userId, email };
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

export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ message: 'Email is required.' });
        return;
    }

    try {
        const [users] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM Users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            console.log(`Password reset requested for non-existent email: ${email}`);
            res.status(200).json({ message: 'If your email is registered, you will receive instructions to reset your password.' });
            return;
        }

        const user = users[0] as User;
        const resetToken = crypto.randomBytes(32).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const tokenHash = await bcrypt.hash(resetToken, salt);

        const expiresAt = new Date(Date.now() + 3600000); 
        await pool.query('DELETE FROM PasswordResetTokens WHERE userId = ?', [user.id]);

        await pool.query<ResultSetHeader>(
            'INSERT INTO PasswordResetTokens (id, userId, tokenHash, expiresAt) VALUES (?, ?, ?, ?)',
            [uuidv4(), user.id, tokenHash, expiresAt]
        );
        //reset password first test
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
        console.log('------------------------------------');
        console.log('PASSWORD RESET REQUESTED');
        console.log(`User Email: ${email}`);
        console.log(`User ID: ${user.id}`);
        console.log(`Plain Reset Token (FOR TESTING ONLY): ${resetToken}`);
        console.log(`Simulated Reset Link: ${resetLink}`);
        console.log('------------------------------------');

        res.status(200).json({ message: 'If your email is registered, you will receive instructions to reset your password.' });

    } catch (error) {
        console.error('Error requesting password reset:', error);
        res.status(500).json({ message: 'Server error while requesting password reset.' });
    }
};
