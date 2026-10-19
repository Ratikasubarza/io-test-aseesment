import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env } from '../../config/env';
import { getBookedRanges } from '../../support/booking-api';
import { pickFreeStay } from '../../test-data/stay';
import { measure, type Sample } from './timing';

// The requests of the Postman collection "API Automation Suite", in the same order and with the
// same names. "Logout" is left out because performance run #16 did not execute it either.
export const REQUEST_NAMES = [
  'Login',
  'Validate Token',
  'All Rooms',
  'Room By Id',
  'Create Room',
  'Update Room',
  'Delete Room',
  'Booking By Id',
  'Create Booking',
  'Delete Booking By Id',
  'All Report',
  'All Message',
  'All Message By Id',
  'Delete Message',
] as const;

interface Room {
  roomid: number;
  roomName: string;
}

interface MessageSummary {
  id: number;
  name: string;
}

// Paths have no trailing slash (the Postman collection uses /room/, /report/ and /message/).
// The site answers a trailing slash with a redirect, and Playwright drops a hand-set Cookie
// header when it follows a redirect, so authenticated calls would get 401. The browser UI uses
// the same slash-free paths, and it keeps the redirect hop out of the measured time.
const url = (path: string): string => `${env.apiBaseUrl}${path}`;
const sleep = (waitMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, waitMs));

async function listRooms(api: APIRequestContext): Promise<Room[]> {
  const response = await api.get(url('/room'));
  return ((await response.json()) as { rooms?: Room[] }).rooms ?? [];
}

async function listMessages(api: APIRequestContext): Promise<MessageSummary[]> {
  const response = await api.get(url('/message'));
  return ((await response.json()) as { messages?: MessageSummary[] }).messages ?? [];
}

// Quick check used before the measured run, so a site that is down gives a clear message.
export async function assertApiReachable(api: APIRequestContext): Promise<void> {
  let response: APIResponse;
  try {
    response = await api.get(url('/room'));
  } catch (error) {
    const reason = error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
    throw new Error(`The API at ${env.apiBaseUrl} could not be reached (${reason}). Nothing was measured.`, { cause: error });
  }
  if (!response.ok()) {
    throw new Error(`GET ${url('/room')} returned HTTP ${response.status()}. Nothing was measured.`);
  }
}

// Sends every request once, in order, and records how long each one took.
//
// In Postman, "Delete Room" deletes the last room in the room list and "Delete Message" deletes
// the last message in the inbox. On a shared public demo site those can belong to somebody else,
// so this flow only deletes what it created itself: a room, a booking, and the inbox message
// that the booking produces.
//
// A response that is not 2xx stops the round. A fast error response would otherwise pull the
// average down and make the API look quicker than it is.
export async function runRound(api: APIRequestContext, round: number, samples: Sample[]): Promise<void> {
  const send = async (name: string, call: () => Promise<APIResponse>): Promise<APIResponse> => {
    const { response, ms } = await measure(call);
    if (!response.ok()) {
      const body = (await response.text()).slice(0, 200);
      throw new Error(`Round ${round}: "${name}" returned HTTP ${response.status()}, so it is not a valid timing sample. ${body}`);
    }
    samples.push({ request: name, round, status: response.status(), ms });
    return response;
  };

  const unique = `${Date.now().toString(36)}${round}`;
  let auth: Record<string, string> = {};
  let createdRoomId: number | undefined;
  let createdBookingId: number | undefined;
  let createdMessageId: number | undefined;
  let guestName: string | undefined;

  try {
    // --- Auth ---
    const login = await send('Login', () =>
      api.post(url('/auth/login'), { data: { username: env.adminUsername, password: env.adminPassword } }),
    );
    const { token } = (await login.json()) as { token?: string };
    if (!token) {
      throw new Error(`Round ${round}: login response has no token`);
    }
    auth = { Cookie: `token=${token}` };

    await send('Validate Token', () => api.post(url('/auth/validate'), { data: { token } }));

    // --- Room ---
    const rooms = await (await send('All Rooms', () => api.get(url('/room')))).json() as { rooms?: Room[] };
    const existingRoom = rooms.rooms?.[0];
    if (!existingRoom) {
      throw new Error(`Round ${round}: the site has no rooms to use`);
    }

    await send('Room By Id', () => api.get(url(`/room/${existingRoom.roomid}`)));

    const roomName = `perf${unique}`;
    await send('Create Room', () =>
      api.post(url('/room'), {
        headers: auth,
        data: {
          roomName,
          type: 'Single',
          accessible: true,
          description: 'Created by the Playwright response-time check and deleted straight away',
          image: 'room1.jpg',
          roomPrice: 100,
          features: ['WiFi', 'TV', 'Radio', 'Refreshments', 'Safe', 'Views'],
        },
      }),
    );

    // The create call only answers { success: true }, so the new room's id is looked up by its name.
    const createdRoom = (await listRooms(api)).find((room) => room.roomName === roomName);
    if (!createdRoom) {
      throw new Error(`Round ${round}: room "${roomName}" was created but is not in the room list`);
    }
    createdRoomId = createdRoom.roomid;

    await send('Update Room', () =>
      api.put(url(`/room/${createdRoom.roomid}`), {
        headers: auth,
        data: {
          roomid: createdRoom.roomid,
          roomName,
          type: 'Double',
          accessible: true,
          description: 'Updated by the Playwright response-time check',
          image: '/images/room1.jpg',
          roomPrice: 120,
          features: ['WiFi', 'TV', 'Radio', 'Safe'],
        },
      }),
    );

    await send('Delete Room', () => api.delete(url(`/room/${createdRoom.roomid}`), { headers: auth }));
    createdRoomId = undefined;

    // --- Booking ---
    await send('Booking By Id', () => api.get(url(`/booking?roomid=${existingRoom.roomid}`), { headers: auth }));

    // Dates are picked so they do not overlap an existing booking (not timed).
    const stay = pickFreeStay(await getBookedRanges(api, existingRoom.roomid), 1);
    const guestFirstname = 'Perf';
    const guestLastname = `Run${unique}`;
    guestName = `${guestFirstname} ${guestLastname}`;
    const booking = await send('Create Booking', () =>
      api.post(url('/booking'), {
        data: {
          roomid: existingRoom.roomid,
          firstname: guestFirstname,
          lastname: guestLastname,
          depositpaid: false,
          bookingdates: { checkin: stay.checkin, checkout: stay.checkout },
          email: `perf.${unique}@example.com`,
          phone: '07700900123',
        },
      }),
    );
    createdBookingId = ((await booking.json()) as { bookingid?: number }).bookingid;
    if (!createdBookingId) {
      throw new Error(`Round ${round}: the booking response has no bookingid`);
    }

    await send('Delete Booking By Id', () => api.delete(url(`/booking/${createdBookingId}`), { headers: auth }));
    createdBookingId = undefined;

    // --- Report and messages ---
    await send('All Report', () => api.get(url('/report'), { headers: auth }));

    // Creating a booking adds a message named "<firstname> <lastname>" to the admin inbox.
    // That message is the one this round reads and deletes.
    const inbox = await (await send('All Message', () => api.get(url('/message'), { headers: auth }))).json() as {
      messages?: MessageSummary[];
    };
    createdMessageId = inbox.messages?.find((message) => message.name === guestName)?.id;
    for (let attempt = 0; createdMessageId === undefined && attempt < 10; attempt++) {
      await sleep(500);
      createdMessageId = (await listMessages(api)).find((message) => message.name === guestName)?.id;
    }
    if (createdMessageId === undefined) {
      throw new Error(`Round ${round}: no inbox message found for "${guestName}"`);
    }

    await send('All Message By Id', () => api.get(url(`/message/${createdMessageId}`), { headers: auth }));
    await send('Delete Message', () => api.delete(url(`/message/${createdMessageId}`), { headers: auth }));
    createdMessageId = undefined;
  } finally {
    // If the round stopped early, remove whatever it had already created. Errors are ignored here
    // because the original failure is the one worth reporting.
    if (auth.Cookie) {
      // The booking may have produced a message even if the round stopped before it was found.
      if (createdMessageId === undefined && guestName !== undefined) {
        createdMessageId = (await listMessages(api).catch(() => [])).find((message) => message.name === guestName)?.id;
      }
      if (createdMessageId !== undefined) {
        await api.delete(url(`/message/${createdMessageId}`), { headers: auth }).catch(() => undefined);
      }
      if (createdBookingId !== undefined) {
        await api.delete(url(`/booking/${createdBookingId}`), { headers: auth }).catch(() => undefined);
      }
      if (createdRoomId !== undefined) {
        await api.delete(url(`/room/${createdRoomId}`), { headers: auth }).catch(() => undefined);
      }
    }
  }
}
