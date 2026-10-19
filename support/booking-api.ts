import { request, type APIRequestContext } from '@playwright/test';
import { env } from '../config/env';
import type { BookedRange } from '../test-data/stay';

// Used for test data only: finding dates that are free, and removing the booking afterwards.
// The behaviour under test always goes through the UI.

export async function getBookedRanges(api: APIRequestContext, roomId: number): Promise<BookedRange[]> {
  const response = await api.get(`${env.baseUrl}/api/report/room/${roomId}`);
  if (!response.ok()) {
    throw new Error(`Could not read existing bookings for room ${roomId}: HTTP ${response.status()}`);
  }
  // The report service answers { report: [...] }; accept a bare array as well.
  const body = (await response.json()) as BookedRange[] | { report?: BookedRange[] };
  const entries = Array.isArray(body) ? body : (body.report ?? []);
  return entries.map(({ start, end }) => ({ start: String(start).slice(0, 10), end: String(end).slice(0, 10) }));
}

export async function deleteBookingAsAdmin(bookingId: number): Promise<void> {
  const api = await request.newContext();
  try {
    const login = await api.post(`${env.baseUrl}/api/auth/login`, {
      data: { username: env.adminUsername, password: env.adminPassword },
    });
    if (!login.ok()) {
      throw new Error(`Admin login failed: HTTP ${login.status()}`);
    }
    const { token } = (await login.json()) as { token?: string };
    if (!token) {
      throw new Error('Admin login returned no token');
    }
    const deleted = await api.delete(`${env.baseUrl}/api/booking/${bookingId}`, {
      headers: { Cookie: `token=${token}` },
    });
    if (!deleted.ok()) {
      throw new Error(`Delete booking ${bookingId} failed: HTTP ${deleted.status()}`);
    }
  } finally {
    await api.dispose();
  }
}
