import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken'; 
import pool from '../config/database';
import { User } from '../types/userTypes';
import { RowDataPacket } from 'mysql2/promise';

const JWT_SECRET_KEY: Secret = process.env.JWT_SECRET || 'your-fallback-secret-key-is-very-important-and-should-be-long';

export interface AuthenticatedRequest extends Request {
  user?: User; 
}

export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
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