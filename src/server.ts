import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

app.get('/', (req: Request, res: Response) => {
  res.send('Minimal Express Server is Running!');
});

app.listen(port, () => {
  console.log(`[server]: Minimal server is running at http://localhost:${port}`);
});