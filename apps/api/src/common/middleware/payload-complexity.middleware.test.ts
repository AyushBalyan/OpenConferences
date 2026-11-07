import { it, expect } from 'vitest';
import { assertPayloadComplexity } from './payload-complexity.middleware';
it('rejects oversized invalid collections before schema issue allocation', () => {
  expect(() => assertPayloadComplexity({ values: Array(10000).fill(null) })).toThrow('too large');
});
it('bounds total validation nodes and nesting without recursive traversal', () => {
  expect(() =>
    assertPayloadComplexity(Array.from({ length: 100 }, () => Array(100).fill(0))),
  ).toThrow('too complex');
  let deep: unknown = {};
  for (let i = 0; i < 40; i++) deep = { child: deep };
  expect(() => assertPayloadComplexity(deep)).toThrow('too complex');
});
it('accepts the supported 500 recipient upload shape', () => {
  expect(() =>
    assertPayloadComplexity({
      rows: Array.from({ length: 500 }, () => ({
        name: 'Author',
        email: 'author@example.test',
        topic: 'Topic',
        paper: 'Paper',
        rowNumber: 1,
      })),
    }),
  ).not.toThrow();
});

it('allows the bounded 1,000-row reviewer job budget without weakening other requests', () => {
  const input = {
    rows: Array.from({ length: 1000 }, () => ({
      name: 'Synthetic researcher',
      email: 'researcher@example.test',
      affiliation: 'Institute',
      researchFields: Array(30).fill('field'),
      rowId: 'row',
    })),
  };
  expect(() => assertPayloadComplexity(input)).toThrow('too complex');
  expect(() => assertPayloadComplexity(input, 45000)).not.toThrow();
});
