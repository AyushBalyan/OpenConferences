import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionClient } from '../common/types/transaction-client';
import { CoiCheckService } from './coi-check.service';

const paper = vi.fn();
const user = vi.fn();
const declared = vi.fn();
const tx = {
  paper: { findFirst: paper },
  user: { findUnique: user },
  conflictOfInterest: { findFirst: declared },
} as unknown as TransactionClient;
const service = new CoiCheckService();
const check = () => service.checkReviewerPaperConflict(tx, 'reviewer', 'paper', 'conference');

describe('shared reviewer authorship conflicts', () => {
  beforeEach(() => {
    paper.mockReset().mockResolvedValue({ submittedById: 'submitter', authorships: [] });
    user.mockReset().mockResolvedValue({ email: 'reviewer@example.com' });
    declared.mockReset().mockResolvedValue(null);
  });
  it('checks the submitting account even without a linked authorship', async () => {
    paper.mockResolvedValue({ submittedById: 'reviewer', authorships: [] });
    expect(await check()).toEqual({ hasConflict: true, reason: 'AUTHORSHIP' });
    expect(user).not.toHaveBeenCalled();
  });
  it('checks linked authorship independently of the email address', async () => {
    paper.mockResolvedValue({
      submittedById: 'submitter',
      authorships: [{ userId: 'reviewer', email: 'old@example.com' }],
    });
    expect(await check()).toEqual({ hasConflict: true, reason: 'AUTHORSHIP' });
  });
  it.each([null, 'another-account'])(
    'checks unlinked or differently linked email authorship: %s',
    async (userId) => {
      paper.mockResolvedValue({
        submittedById: 'submitter',
        authorships: [{ userId, email: '  REVIEWER@Example.COM  ' }],
      });
      user.mockResolvedValue({ email: ' Reviewer@example.com ' });
      expect(await check()).toEqual({ hasConflict: true, reason: 'AUTHORSHIP' });
      expect(declared).not.toHaveBeenCalled();
    },
  );
  it('does not mistake another address for the reviewer or block unrelated papers', async () => {
    paper.mockResolvedValue({
      submittedById: 'submitter',
      authorships: [{ userId: null, email: 'other@example.com' }],
    });
    expect(await check()).toEqual({ hasConflict: false });
  });
  it('preserves declared conflicts with the paper, its submitter and linked coauthors', async () => {
    paper.mockResolvedValue({
      submittedById: 'submitter',
      authorships: [{ userId: 'coauthor', email: 'coauthor@example.com' }],
    });
    declared.mockResolvedValue({ id: 'coi' });
    expect(await check()).toEqual({ hasConflict: true, reason: 'DECLARED_COI' });
    expect(declared).toHaveBeenCalledWith({
      where: {
        conferenceId: 'conference',
        userId: 'reviewer',
        OR: [{ paperId: 'paper' }, { withUserId: { in: ['submitter', 'coauthor'] } }],
      },
    });
  });
  it('loads the requested conference paper before checking identity', async () => {
    paper.mockResolvedValue(null);
    expect(await check()).toEqual({ hasConflict: false });
    expect(paper.mock.calls[0]?.[0].where).toEqual({ id: 'paper', conferenceId: 'conference' });
    expect(user).not.toHaveBeenCalled();
    expect(declared).not.toHaveBeenCalled();
  });
  it('does not match blank addresses when the reviewer cannot be found', async () => {
    user.mockResolvedValue(null);
    paper.mockResolvedValue({
      submittedById: 'submitter',
      authorships: [{ userId: null, email: '' }],
    });
    expect(await check()).toEqual({ hasConflict: false });
  });
});
