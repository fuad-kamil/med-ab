import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetPassword } from '../controllers/userController.js';
import { User } from '../models/User.js';

vi.mock('../models/User.js');

describe('resetPassword Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { params: { id: 'u1' }, body: {} };
    res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    vi.clearAllMocks();
    User.hashPassword = vi.fn().mockResolvedValue('new_hash_123');
  });

  it('resets password and returns the generated plaintext password once', async () => {
    const mockUser = {
      _id: 'u1',
      studentId: 'STU001',
      fullName: 'Abebe Bikila',
      role: 'student',
      save: vi.fn().mockResolvedValue(true),
    };

    User.findById.mockResolvedValue(mockUser);

    await resetPassword(req, res);

    expect(mockUser.passwordHash).toBe('new_hash_123');
    expect(mockUser.failedLoginAttempts).toBe(0);
    expect(mockUser.lockedUntil).toBeNull();
    expect(mockUser.save).toHaveBeenCalledTimes(1);

    const response = res.json.mock.calls[0][0];
    expect(response.message).toBe('Password reset successfully');
    expect(response.studentId).toBe('STU001');
    expect(response.fullName).toBe('Abebe Bikila');
    expect(response.newPassword).toBeDefined();
    expect(response.newPassword.length).toBeGreaterThanOrEqual(6);
  });
});
