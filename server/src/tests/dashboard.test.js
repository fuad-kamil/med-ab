import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminDashboard } from '../controllers/dashboardController.js';
import { User } from '../models/User.js';
import { Exam } from '../models/Exam.js';
import { Attempt } from '../models/Attempt.js';
import { Category } from '../models/Category.js';

vi.mock('../models/User.js');
vi.mock('../models/Exam.js');
vi.mock('../models/Attempt.js');
vi.mock('../models/Category.js');

describe('getAdminDashboard Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    vi.clearAllMocks();
  });

  it('aggregates dashboard counts and sections correctly', async () => {
    User.countDocuments
      .mockResolvedValueOnce(100) // totalStudents
      .mockResolvedValueOnce(90);  // activeStudents

    Exam.countDocuments
      .mockResolvedValueOnce(10) // totalExams
      .mockResolvedValueOnce(3)  // draftExams
      .mockResolvedValueOnce(2);  // openExamsCount

    Attempt.countDocuments.mockResolvedValueOnce(15); // submissionsThisWeek

    // Mock openExams query
    Exam.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            {
              _id: 'exam1',
              title: 'Fiqh Basics',
              accessToken: 'abc12345',
              categoryId: { _id: 'cat1', name: 'Fiqh' },
              durationMinutes: 30,
              status: 'open',
            },
          ]),
        }),
      }),
    });

    Attempt.aggregate.mockResolvedValue([
      { _id: 'exam1', started: 2, submitted: 1 },
    ]);

    Attempt.find.mockImplementation(() => {
      return {
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([
                  {
                    _id: 'att1',
                    studentId: { studentId: 'STU001', fullName: 'Abebe' },
                    examId: { _id: 'exam1', title: 'Fiqh Basics', passMark: 70 },
                    scoreEarned: 80,
                    totalMaxPoints: 100,
                    submittedAt: new Date(),
                  },
                ]),
              }),
            }),
          }),
        }),
      };
    });

    Category.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: 'cat1', name: 'Fiqh' },
        ]),
      }),
    });

    User.aggregate.mockResolvedValue([{ _id: 'cat1', count: 45 }]);
    Exam.aggregate.mockResolvedValue([{ _id: 'cat1', count: 5 }]);

    await getAdminDashboard(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const data = res.json.mock.calls[0][0];

    expect(data.overview).toEqual({
      totalStudents: 100,
      activeStudents: 90,
      totalExams: 10,
      draftExams: 3,
      openExamsCount: 2,
      submissionsThisWeek: 15,
    });
    expect(data.liveExams.length).toBe(1);
    expect(data.liveExams[0].title).toBe('Fiqh Basics');
    expect(data.liveExams[0].submitted).toBe(1);
    expect(data.liveExams[0].started).toBe(2);
    expect(data.recentSubmissions.length).toBe(1);
    expect(data.categoriesOverview.length).toBe(1);
  });
});
