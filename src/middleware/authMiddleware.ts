
import type { Request, Response, NextFunction } from 'express'; 
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import pool from '../config/database';
import type { User } from '../types/userTypes'; 
import { RowDataPacket } from 'mysql2/promise';

const JWT_SECRET_KEY: Secret = process.env.JWT_SECRET || 
    (process.env.NODE_ENV === 'production' ? (() => { throw new Error("JWT_SECRET not set in production for authMiddleware!"); })() : 'your-dev-fallback-secret-key-32-chars-long-for-auth');

if (JWT_SECRET_KEY === 'your-dev-fallback-secret-key-32-chars-long-for-auth' && process.env.NODE_ENV !== 'test') {
    console.warn('WARNING: JWT_SECRET in authMiddleware is using a fallback value. Please set a strong, unique secret in your .env file for production.');
}
export interface AuthenticatedRequest extends Request {
  user?: User; 
  
}

export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET_KEY) as (JwtPayload & { userId: string });

      const [users] = await pool.query<RowDataPacket[]>(
        'SELECT id, email, username FROM Users WHERE id = ?',
        [decoded.userId]
      );

      if (users.length === 0) {
        res.status(401).json({ message: 'Not authorized, user not found.' });
        return; 
      }
   
      req.user = users[0] as User; 
      next(); 
      return; 

    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({ message: 'Not authorized, token failed.' });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token.' });
    return;
  }
};