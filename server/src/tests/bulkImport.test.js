import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkImport } from '../controllers/userController.js';
import { User } from '../models/User.js';

vi.mock('../models/User.js');
vi.mock('../models/Counter.js', () => ({
  reserveStudentIdBlock: vi.fn().mockImplementation((n) => {
    const ids = [];
    for (let i = 1; i <= n; i++) ids.push(`STU-0${i}`);
    return Promise.resolve(ids);
  }),
  getNextStudentId: vi.fn().mockResolvedValue('STU-01'),
}));

describe('bulkImport Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    vi.clearAllMocks();
    User.hashPassword = vi.fn().mockResolvedValue('hashed_pw');
  });

  it('imports valid CSV rows and generates sequential student IDs', async () => {
    req.body = {
      csv: 'fullName,gender\nAbebe Bikila,male\nFatima Ali,female',
    };

    User.create.mockImplementation((data) =>
      Promise.resolve({
        toSafeJSON: () => data,
        studentId: data.studentId,
        fullName: data.fullName,
      })
    );

    await bulkImport(req, res);

    expect(User.create).toHaveBeenCalledTimes(2);
    const response = res.json.mock.calls[0][0];

    expect(response.imported).toBe(2);
    expect(response.failed).toBe(0);
    expect(response.results.length).toBe(2);
    expect(response.results[0].studentId).toBe('STU-01');
    expect(response.results[1].studentId).toBe('STU-02');
    expect(response.results[0].password).toBeDefined();
  });

  it('ignores studentId column if present and sets a notice', async () => {
    req.body = {
      csv: 'studentId,fullName\nOLD_ID_1,Abebe Bikila\nOLD_ID_2,Fatima Ali',
    };

    User.create.mockImplementation((data) =>
      Promise.resolve({
        studentId: data.studentId,
        fullName: data.fullName,
      })
    );

    await bulkImport(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.imported).toBe(2);
    expect(response.notice).toContain('Provided Student IDs were ignored');
    expect(response.results[0].studentId).toBe('STU-01');
  });
});
