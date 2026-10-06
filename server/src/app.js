import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
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

// Security
app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin === env.CLIENT_URL ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
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
