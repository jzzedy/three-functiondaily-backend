import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
//import pool from './config/database';
//import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import expenseRoutes from './routes/expenseRoutes';
import habitRoutes from './routes/habitRoutes';
import aiRoutes from './routes/aiRoutes'; 

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

const allowedOrigins: (string | undefined)[] = [
  'http://localhost:5173', 
  process.env.FRONTEND_PROD_URL 
];
const filteredAllowedOrigins = allowedOrigins.filter(Boolean) as string[];
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin || filteredAllowedOrigins.includes(origin) || (origin && origin.endsWith('.onrender.com'))) {
      callback(null, true);
    } else {
      console.warn(`CORS: Request from origin ${origin} blocked.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], 
  credentials: true 
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
  res.send('Server with core middleware (no app.options, no app routes) is Running!');
});

app.listen(port, () => {
  console.log(`[server]: Server (core middleware only) is running on port ${port}`);
});