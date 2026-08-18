import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

import { sendEmail } from '../resend';

describe('sendEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards attachments to resend', async () => {
    sendMock.mockResolvedValue({});

    await sendEmail({
      to: 'a@b.com',
      subject: 'Your schedule',
      html: '<p>hi</p>',
      attachments: [{ filename: 'schedule.ics', content: 'QkVHSU4=' }],
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.com',
        attachments: [{ filename: 'schedule.ics', content: 'QkVHSU4=' }],
      })
    );
  });
});
