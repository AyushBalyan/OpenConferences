/** Add fictional accepted papers while preserving the running author's existing payments. */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const api = process.env.DEMO_API_URL ?? 'http://127.0.0.1:3021';
const url = new URL(api);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local demo API only.');
const response = await fetch(new URL('/__demo/state', api));
if (!response.ok) throw new Error('Could not read the running dummy author dataset.');
const state = await response.json();
if (!state.conference.myRoles.includes('AUTHOR')) throw new Error('Use the author demo API.');

const template = state.papers.find((p) => p.submittedById === state.user.id &&
  state.decisions.some((d) => d.paperId === p.id && d.outcome === 'ACCEPT' && d.notifiedAt));
if (!template) throw new Error('An accepted dummy author paper is required as a template.');
const registration = state.registrations.find((r) => r.paperId === template.id);
const round = state.rounds.find((r) => r.id === template.latestCycleId);
const decision = state.decisions.find((d) => d.paperId === template.id);
const timestamp = new Date().toISOString();
const added = [];
for (const [title, country] of [
  ['Privacy-Preserving Analytics for Smart Campuses', 'IN'],
  ['Trustworthy AI for Scientific Peer Review', 'US'],
  ['Energy-Efficient Edge Computing for Rural Healthcare', 'IN'],
  ['Open Research Data Pipelines for Climate Resilience', 'GB'],
]) {
  if (state.papers.some((p) => p.title === title)) continue;
  const paper = structuredClone(template);
  Object.assign(paper, {
    id: randomUUID(), title, status: 'DECISION_MADE',
    submissionNumber: `ICACM-TEST-${state.papers.length + 1}`,
    abstract: `Fictional accepted paper for local registration and test-payment testing: ${title}.`,
    createdAt: timestamp, updatedAt: timestamp, submittedAt: timestamp,
    latestCycleId: randomUUID(), currentVersionId: randomUUID(),
    cameraReadyVersion: null, version: 1,
  });
  paper.authorships = paper.authorships.map((a) => ({ ...a, id: randomUUID(), paperId: paper.id, country }));
  paper.currentVersion = {
    ...paper.currentVersion, id: paper.currentVersionId, paperId: paper.id,
    fileAssetId: randomUUID(), createdAt: timestamp,
    fileAsset: { ...paper.currentVersion.fileAsset, id: undefined, originalFilename: `${paper.submissionNumber}.pdf` },
  };
  paper.currentVersion.fileAsset.id = paper.currentVersion.fileAssetId;
  state.papers.push(paper);
  state.rounds.push({ ...structuredClone(round), id: paper.latestCycleId, paperId: paper.id, submissionNumber: paper.submissionNumber, createdAt: timestamp, updatedAt: timestamp });
  state.decisions.push({
    ...structuredClone(decision), id: randomUUID(), paperId: paper.id, paperTitle: title,
    paperSubmittedAt: timestamp, submissionNumber: paper.submissionNumber,
    roundId: paper.latestCycleId, outcome: 'ACCEPT', notifiedAt: timestamp,
    rationale: 'Accepted dummy paper, ready for registration testing.', createdAt: timestamp, updatedAt: timestamp,
  });
  state.registrations.push({
    ...structuredClone(registration), id: randomUUID(), paperId: paper.id, paperTitle: title,
    paperSubmittedAt: timestamp, audience: 'REGULAR', status: 'PENDING',
    billingCountry: country, currency: country === 'IN' ? 'INR' : 'USD',
    amountDueMinor: country === 'IN'
      ? Math.round(state.conference.feeSchedule.additionalPaperMinor * state.conference.feeSchedule.domesticInrPerUsd)
      : state.conference.feeSchedule.additionalPaperMinor,
    lockedTiming: null, isAdditionalPaper: true, createdAt: timestamp, updatedAt: timestamp, version: 1,
  });
  added.push({ title, country, paperId: paper.id });
}
const output = process.env.DEMO_STATE_FILE ?? '/private/tmp/openconferences-author-state.json';
writeFileSync(output, JSON.stringify(state), { mode: 0o600 });
console.log(JSON.stringify({ stateFile: output, added, note: 'Restart the author demo with DEMO_STATE_FILE set to this path.' }, null, 2));
