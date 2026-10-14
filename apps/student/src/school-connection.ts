/** Connectivity proof only; this is never a progress receipt or publication proof. */
export async function checkSchoolConnection(signal: AbortSignal, request: typeof fetch = fetch): Promise<void> {
  const response = await request('/api/health', { cache: 'no-store', signal });
  if (!response.ok) throw new Error('The school connection is unavailable. Your saved learning stays on this device.');
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || !('service' in value) || value.service !== 'local-recorded-lessons'
    || !('cloud' in value) || value.cloud !== false) throw new Error('The configured lesson service did not confirm its connection.');
}
