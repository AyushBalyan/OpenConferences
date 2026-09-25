import { beforeEach, describe, expect, it, vi } from 'vitest';

const review = vi.hoisted(() => ({ listRounds: vi.fn(), listDecisions: vi.fn() }));
vi.mock('@ts-rest/core', () => ({ initClient: () => ({ review }) }));
vi.mock('@openconferences/contracts', () => ({ apiContract: {} }));

import { fetchDecisions, fetchReviewRounds } from './api-client';

beforeEach(() => vi.resetAllMocks());

describe('review pagination', () => {
  it('loads cycles beyond the first 20, through every cursor', async () => {
    const first = Array.from({ length: 20 }, (_, index) => ({ id: `cycle-${index}` }));
    review.listRounds
      .mockResolvedValueOnce({ status: 200, body: { data: first, nextCursor: 'page-2' } })
      .mockResolvedValueOnce({
        status: 200,
        body: { data: [{ id: 'cycle-20' }], nextCursor: 'page-3' },
      })
      .mockResolvedValueOnce({
        status: 200,
        body: { data: [{ id: 'cycle-21' }], nextCursor: null },
      });
    expect(await fetchReviewRounds('conference')).toHaveLength(22);
    expect(review.listRounds).toHaveBeenNthCalledWith(2, {
      params: { conferenceId: 'conference' },
      query: { cursor: 'page-2' },
    });
    expect(review.listRounds).toHaveBeenCalledTimes(3);
  });

  it('rejects a later-page failure rather than returning incomplete cycles', async () => {
    review.listRounds
      .mockResolvedValueOnce({ status: 200, body: { data: [], nextCursor: 'page-2' } })
      .mockResolvedValueOnce({ status: 500 });
    await expect(fetchReviewRounds('conference')).rejects.toThrow('Failed to load review rounds');
  });

  it('includes current decisions beyond historical pages and retains an optional cycle filter', async () => {
    const old = { paperId: 'paper', roundId: 'old-cycle' };
    const current = { paperId: 'paper', roundId: 'current-cycle' };
    review.listDecisions
      .mockResolvedValueOnce({ status: 200, body: { data: [old], nextCursor: 'page-2' } })
      .mockResolvedValueOnce({ status: 200, body: { data: [current], nextCursor: null } });
    expect((await fetchDecisions('conference')).data).toEqual([old, current]);
    expect(review.listDecisions).toHaveBeenLastCalledWith({
      params: { conferenceId: 'conference' },
      query: { cursor: 'page-2' },
    });
    review.listDecisions.mockResolvedValueOnce({
      status: 200,
      body: { data: [], nextCursor: null },
    });
    await fetchDecisions('conference', 'current-cycle');
    expect(review.listDecisions).toHaveBeenLastCalledWith({
      params: { conferenceId: 'conference' },
      query: { roundId: 'current-cycle' },
    });
  });
});
