import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSystemSettings, updateSystemSettings, exportBackupData } from '../controllers/adminSettingsController.js';
import { changeAdminPassword } from '../controllers/authController.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { ExamSnapshot } from '../models/ExamSnapshot.js';
import { Attempt } from '../models/Attempt.js';

vi.mock('../models/SystemSettings.js');
vi.mock('../models/User.js');
vi.mock('../models/Category.js');
vi.mock('../models/Exam.js');
vi.mock('../models/Question.js');
vi.mock('../models/ExamSnapshot.js');
vi.mock('../models/Attempt.js');
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('newHashedPass'),
  },
}));

describe('Settings Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, user: { userId: 'admin1', role: 'admin', tokenVersion: 1 } };
    res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe('getSystemSettings', () => {
    it('returns default singleton settings and emailConfigured flag', async () => {
      const mockDoc = {
        senderName: 'Medresa Exam Portal',
        replyToEmail: 'admin@medresa.edu',
        resultEmailLanguage: 'auto',
        resultEmailIncludeAnswers: 'auto',
      };
      SystemSettings.findOne.mockResolvedValue(mockDoc);

      await getSystemSettings(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: mockDoc,
          emailConfigured: expect.any(Boolean),
        })
      );
    });
  });

  describe('updateSystemSettings', () => {
    it('updates system settings document and saves', async () => {
      req.body = {
        senderName: 'Medresa Portal',
        replyToEmail: 'reply@medresa.edu',
        resultEmailLanguage: 'en',
        resultEmailIncludeAnswers: 'always',
      };

      const mockSettingsDoc = {
        senderName: '',
        replyToEmail: '',
        resultEmailLanguage: 'auto',
        resultEmailIncludeAnswers: 'auto',
        save: vi.fn().mockResolvedValue(true),
      };
      SystemSettings.findOne.mockResolvedValue(mockSettingsDoc);

      await updateSystemSettings(req, res);

      expect(mockSettingsDoc.save).toHaveBeenCalled();
      expect(mockSettingsDoc.senderName).toBe('Medresa Portal');
      expect(mockSettingsDoc.replyToEmail).toBe('reply@medresa.edu');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'System settings updated successfully',
        })
      );
    });
  });

  describe('exportBackupData', () => {
    it('exports JSON backup containing students and excluding passwordHash', async () => {
      const mockQueryChain = (data) => ({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(data),
        }),
        lean: vi.fn().mockResolvedValue(data),
      });

      User.find.mockReturnValue(mockQueryChain([{ fullName: 'Student 1' }]));
      Category.find.mockReturnValue(mockQueryChain([{ name: 'Fiqh' }]));
      Exam.find.mockReturnValue(mockQueryChain([{ title: 'Midterm' }]));
      Question.find.mockReturnValue(mockQueryChain([]));
      ExamSnapshot.find.mockReturnValue(mockQueryChain([]));
      Attempt.find.mockReturnValue(mockQueryChain([{ score: 90 }]));

      const mockSettingsDoc = {
        save: vi.fn().mockResolvedValue(true),
        toObject: () => ({ senderName: 'Medresa' }),
      };

      SystemSettings.findOne
        .mockReturnValueOnce(mockQueryChain({ senderName: 'Medresa' }))
        .mockResolvedValueOnce(mockSettingsDoc);

      await exportBackupData(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(res.send).toHaveBeenCalled();

      const jsonStr = res.send.mock.calls[0][0];
      const parsed = JSON.parse(jsonStr);
      expect(parsed).toHaveProperty('students');
      expect(parsed).toHaveProperty('meta');
      expect(parsed.meta.system).toBe('Medresa Exam Portal');
      expect(parsed.students[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('changeAdminPassword', () => {
    it('rejects passwords shorter than 8 characters', async () => {
      req.body = { currentPassword: 'old', newPassword: 'short' };
      await expect(changeAdminPassword(req, res)).rejects.toThrow(/8 characters/);
    });

    it('rejects common passwords', async () => {
      req.body = { currentPassword: 'old', newPassword: 'password' };
      await expect(changeAdminPassword(req, res)).rejects.toThrow(/Password is too common/);
    });

    it('updates password and increments tokenVersion for session revocation', async () => {
      req.body = { currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' };
      const adminUser = {
        _id: 'admin1',
        role: 'admin',
        passwordHash: 'oldHash',
        tokenVersion: 1,
        comparePassword: vi.fn().mockResolvedValue(true),
        toSafeJSON: vi.fn().mockReturnValue({ _id: 'admin1', username: 'admin' }),
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(adminUser);

      await changeAdminPassword(req, res);

      expect(adminUser.tokenVersion).toBe(2);
      expect(adminUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String), token: expect.any(String) })
      );
    });
  });
});
