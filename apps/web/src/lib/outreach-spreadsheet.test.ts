import { describe, expect, it } from 'vitest';
import { parseOutreachSpreadsheet } from './outreach-spreadsheet';

describe('parseOutreachSpreadsheet', () => {
  it('parses CSV with name, email, topic, and paper title', async () => {
    const csv = `name,email,topic,paper title
Dr. John Smith,john@example.com,Artificial Intelligence,Advances in Machine learning technologies
`;
    const file = new File([csv], 'recipients.csv', { type: 'text/csv' });
    const result = await parseOutreachSpreadsheet(file);
    expect(result.error).toBeUndefined();
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        name: 'Dr. John Smith',
        email: 'john@example.com',
        topic: 'Artificial Intelligence',
        paper: 'Advances in Machine learning technologies',
      },
    ]);
  });

  it('rejects files without name/email headers', async () => {
    const file = new File(['foo,bar\n1,2'], 'bad.csv', { type: 'text/csv' });
    const result = await parseOutreachSpreadsheet(file);
    expect(result.rows).toHaveLength(0);
    expect(result.error).toMatch(/name and email/i);
  });
});
