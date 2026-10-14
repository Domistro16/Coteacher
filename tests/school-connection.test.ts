import { describe, expect, it, vi } from 'vitest';
import { checkSchoolConnection } from '../apps/student/src/school-connection';

describe('school reachability is distinct from progress synchronization', () => {
  it('requires an actual recognized service response without sending learner records', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ service: 'local-recorded-lessons', cloud: false }));
    const signal = new AbortController().signal;
    await checkSchoolConnection(signal, request);
    expect(request).toHaveBeenCalledWith('/api/health', { cache: 'no-store', signal });
  });
  it.each([{ status: 'ok' }, { service: 'local-recorded-lessons', cloud: true }])('does not accept an unrelated success response %j', async value => {
    await expect(checkSchoolConnection(new AbortController().signal, vi.fn<typeof fetch>().mockResolvedValue(Response.json(value)))).rejects.toThrow('did not confirm');
  });
  it('does not equate HTTP errors or failed transport with a connection', async () => {
    await expect(checkSchoolConnection(new AbortController().signal, vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 })))).rejects.toThrow('unavailable');
    await expect(checkSchoolConnection(new AbortController().signal, vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')))).rejects.toThrow();
  });
});
