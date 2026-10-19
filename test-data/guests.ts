import guestData from './guests.json';

export interface Guest {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
}

const guests: Record<string, Guest> = guestData;

export function getGuest(name: string): Guest {
  const guest = guests[name];
  if (!guest) {
    throw new Error(`No guest data set called "${name}". Available: ${Object.keys(guests).join(', ')}`);
  }
  return guest;
}
