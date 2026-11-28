// Server-side test mode also applies to next build / next start.
export function communicationsDesactivees(): boolean {
  return process.env.BOOKING_TEST_MODE === "1";
}
