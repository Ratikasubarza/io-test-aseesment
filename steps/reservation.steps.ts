import { Given, Then, When } from '@cucumber/cucumber';
import type { Response } from '@playwright/test';
import { getBookedRanges } from '../support/booking-api';
import { expect } from '../support/expect';
import type { CustomWorld } from '../support/world';
import { getGuest } from '../test-data/guests';
import { pickFreeStay } from '../test-data/stay';

interface BookingBody {
  bookingid?: number;
  roomid?: number;
  firstname?: string;
  lastname?: string;
  bookingdates?: { checkin?: string; checkout?: string };
}

const isBookingRequest = (response: Response): boolean =>
  response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/booking';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function requireState<T>(value: T | undefined, description: string): T {
  if (value === undefined) {
    throw new Error(`${description} is not set. A previous step in the scenario is missing.`);
  }
  return value;
}

// ---------- Given / When ----------

Given('the guest is on the home page', async function (this: CustomWorld) {
  await this.homePage.open();
});

When('the guest chooses to book the {string} room', async function (this: CustomWorld, roomType: string) {
  await this.homePage.bookRoom(roomType);
  await expect(this.reservationPage.roomHeading).toHaveText(`${roomType} Room`);
});

When(
  'the guest selects a {int}-night stay on dates that are not booked yet',
  async function (this: CustomWorld, nights: number) {
    const booked = await getBookedRanges(this.context.request, this.reservationPage.roomId());
    this.stay = pickFreeStay(booked, nights);
    await this.reservationPage.selectStay(this.stay);
  },
);

When('the guest starts the reservation', async function (this: CustomWorld) {
  await this.reservationPage.startReservation();
});

When('the guest enters the {string} guest details', async function (this: CustomWorld, dataSet: string) {
  this.guest = getGuest(dataSet);
  await this.reservationPage.fillGuestDetails(this.guest);
});

When('the guest confirms the reservation', async function (this: CustomWorld) {
  // Start listening before the click so the response cannot be missed.
  const [response] = await Promise.all([
    this.page.waitForResponse(isBookingRequest),
    this.reservationPage.confirmReservation(),
  ]);
  this.bookingResponse = response;

  // Remember the id straight away, so the After hook can delete the booking even if a later step fails.
  if (response.status() === 201) {
    const body = (await response.json().catch(() => ({}))) as BookingBody;
    this.createdBookingId = body.bookingid;
  }
});

// ---------- Then: price summary ----------

Then(
  'the price summary adds a £{int} cleaning fee and a £{int} service fee to the room rate',
  async function (this: CustomWorld, cleaningFee: number, serviceFee: number) {
    const stay = requireState(this.stay, 'The stay');
    const page = this.reservationPage;

    // The nightly rate is read from the page so the test does not break if the demo's price changes;
    // what is checked is the arithmetic and the two fixed fees.
    const rate = await page.readNightlyRate();
    const base = rate * stay.nights;

    await expect(page.baseRateLabel).toHaveText(new RegExp(`^£${rate} x ${stay.nights} nights?$`));
    await expect(page.baseRateAmount).toHaveText(`£${base}`);
    await expect(page.cleaningFeeAmount).toHaveText(`£${cleaningFee}`);
    await expect(page.serviceFeeAmount).toHaveText(`£${serviceFee}`);
    await expect(page.totalAmount).toHaveText(`£${base + cleaningFee + serviceFee}`);
  },
);

// ---------- Then: successful booking ----------

Then('the booking is accepted with status {int}', async function (this: CustomWorld, status: number) {
  const response = requireState(this.bookingResponse, 'The booking response');
  const stay = requireState(this.stay, 'The stay');
  const guest = requireState(this.guest, 'The guest');

  expect(response.status()).toBe(status);

  const body = (await response.json()) as BookingBody;
  expect(body.roomid).toBe(this.reservationPage.roomId());
  expect(body.firstname).toBe(guest.firstname);
  expect(body.lastname).toBe(guest.lastname);
  expect(body.bookingdates).toEqual({ checkin: stay.checkin, checkout: stay.checkout });
  expect(body.bookingid, 'the server should return a booking id').toBeGreaterThan(0);
});

Then('the booking confirmation shows the selected dates', async function (this: CustomWorld) {
  const stay = requireState(this.stay, 'The stay');
  await expect(this.reservationPage.confirmationHeading).toBeVisible();
  await expect(this.page.getByText(`${stay.checkin} - ${stay.checkout}`)).toBeVisible();
});

// ---------- Then: rejected booking ----------

Then('the booking is rejected with status {int}', function (this: CustomWorld, status: number) {
  const response = requireState(this.bookingResponse, 'The booking response');
  expect(response.status()).toBe(status);
});

Then('the guest sees the error {string}', async function (this: CustomWorld, message: string) {
  // toHaveText with an array checks the whole list, so this also proves there are no extra errors.
  await expect(this.reservationPage.errorMessages).toHaveText([new RegExp(escapeRegExp(message), 'i')]);
});

Then('no booking confirmation is shown', async function (this: CustomWorld) {
  await expect(this.reservationPage.confirmationHeading).toHaveCount(0);
  // The form is still on screen with what the guest typed, so they can correct it.
  const guest = requireState(this.guest, 'The guest');
  await expect(this.reservationPage.email).toHaveValue(guest.email);
  expect(this.createdBookingId, 'no booking should have been created').toBeUndefined();
});
