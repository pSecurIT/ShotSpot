import dotenv from 'dotenv';
import validateEnv from './utils/validateEnv.js';
import app from './app.js';

// Load and validate environment variables
dotenv.config();
validateEnv();

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});