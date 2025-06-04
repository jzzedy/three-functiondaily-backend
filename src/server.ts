import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool from './config/database'; 
import authRoutes from './routes/authRoutes';
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

const checkDbConnection = async () => { 
    try {
        const connection = await pool.getConnection();
        console.log('Database connected successfully on server startup.');
        await connection.query('SELECT 1');
        connection.release();
    } catch (error) {
        console.error('Failed to connect to database on server startup:', error);
        process.exit(1); 
    }
};

//API Routes 
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/habits', habitRoutes);
app.use('/api/v1/ai', aiRoutes); 


app.get('/api/v1', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to ThreeFunctionDaily API!' });
});

app.get('/api/v1/db-test', async (req: Request, res: Response) => { 
    try {
        const [rows] = await pool.query('SELECT NOW() as currentTime');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('DB test route error:', error);
        res.status(500).json({ success: false, message: 'Failed to query database.' });
    }
});

const startServer = async () => {
    await checkDbConnection();
    app.listen(port, () => {
      console.log(`[server]: Server is running at http://localhost:${port}`);
    });
};

startServer();