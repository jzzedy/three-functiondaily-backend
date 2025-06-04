import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool from './config/database';

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
app.options('*', cors(corsOptions)); 

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


app.get('/', (req: Request, res: Response) => {
  res.send('Minimal Express Server is Running!');
});

app.listen(port, () => {
  console.log(`[server]: Minimal server is running at http://localhost:${port}`);
});