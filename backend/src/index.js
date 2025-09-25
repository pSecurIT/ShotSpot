const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const validateEnv = require('./utils/validateEnv');

// Load and validate environment variables
dotenv.config();
validateEnv();

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true,
  maxAge: 600 // 10 minutes
};
app.use(cors(corsOptions));

// Body parser with size limits
app.use(express.json({ limit: '10kb' }));

// Routes
app.use('/api/teams', require('./routes/teams'));
app.use('/api/players', require('./routes/players'));

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});