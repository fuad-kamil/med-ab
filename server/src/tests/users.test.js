import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listUsers, bulkAction } from '../controllers/userController.js';
import { User } from '../models/User.js';

vi.mock('../models/User.js');

describe('User Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = { query: {}, body: {} };
    res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    vi.clearAllMocks();
  });

  describe('listUsers', () => {
    it('returns paginated users with correct sorting and total count', async () => {
      req.query = { page: '1', limit: '10', search: 'Abebe', sortBy: 'studentId', sortOrder: 'asc' };

      const mockUsers = [
        { _id: 'u1', studentId: 'STU001', fullName: 'Abebe Bikila', role: 'student' },
      ];

      User.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              skip: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  lean: vi.fn().mockResolvedValue(mockUsers),
                }),
              }),
            }),
          }),
        }),
      });

      User.countDocuments.mockResolvedValue(1);

      await listUsers(req, res);

      expect(User.find).toHaveBeenCalledWith({
        role: 'student',
        $or: [
          { fullName: { $regex: '^Abebe', $options: 'i' } },
          { studentId: { $regex: '^Abebe', $options: 'i' } },
          { email: { $regex: '^Abebe', $options: 'i' } },
        ],
      });

      expect(res.json).toHaveBeenCalledWith({
        users: mockUsers,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      });
    });
  });

  describe('bulkAction', () => {
    it('activates selected students in bulk', async () => {
      req.body = { action: 'activate', studentIds: ['s1', 's2'] };
      User.updateMany.mockResolvedValue({ modifiedCount: 2 });

      await bulkAction(req, res);

      expect(User.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ['s1', 's2'] }, role: 'student' },
        { $set: { isActive: true } }
      );
      expect(res.json).toHaveBeenCalledWith({ message: 'Activated 2 students' });
    });

    it('deactivates selected students in bulk', async () => {
      req.body = { action: 'deactivate', studentIds: ['s1'] };
      User.updateMany.mockResolvedValue({ modifiedCount: 1 });

      await bulkAction(req, res);

      expect(User.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ['s1'] }, role: 'student' },
        { $set: { isActive: false } }
      );
      expect(res.json).toHaveBeenCalledWith({ message: 'Deactivated 1 students' });
    });

    it('deletes selected students in bulk', async () => {
      req.body = { action: 'delete', studentIds: ['s1', 's2'] };
      User.deleteMany.mockResolvedValue({ deletedCount: 2 });

      await bulkAction(req, res);

      expect(User.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ['s1', 's2'] },
        role: 'student',
      });
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted 2 students' });
    });
  });
});
