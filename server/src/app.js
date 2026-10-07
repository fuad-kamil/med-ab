import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import examRoutes from './routes/exams.js';
import questionRoutes from './routes/questions.js';
import studentRoutes from './routes/student.js';
import categoryRoutes from './routes/categories.js';
import resultsRoutes from './routes/results.js';
import adminDashboardRoutes from './routes/adminDashboard.js';
import adminSettingsRoutes from './routes/adminSettings.js';
import emailRoutes from './routes/email.js';
import aiRoutes from './routes/ai.js';

const app = express();

app.use(compression());

// Security
app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile, health checks)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      const cleanClientUrl = (env.CLIENT_URL || '').replace(/\/$/, '');

      if (
        cleanOrigin === cleanClientUrl ||
        cleanOrigin.endsWith('.vercel.app') ||
        cleanOrigin.includes('localhost') ||
        cleanOrigin.includes('127.0.0.1')
      ) {
        return callback(null, origin);
      }
      return callback(null, origin);
    },
    credentials: true,
  })
);
app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Root & Health Routes
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Exam Portal Backend API is running' });
});
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/exams/:examId/questions', questionRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/ai', aiRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', code: 404 });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
