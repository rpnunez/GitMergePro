import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { apiRouter } from './server/api.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', apiRouter);

// Serve static assets from dist in production
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GitMerge Pro server listening on port ${PORT}`);
});
