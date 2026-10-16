export const INT4_MIN = -2147483648;
export const INT4_MAX = 2147483647;

/** Largest |amount| an unauthenticated caller may apply in one request. */
export const ANONYMOUS_MAX_INCREMENT = 1;

export class CounterOverflowError extends Error {
  constructor() {
    super("Counter value would exceed the supported range");
    this.name = "CounterOverflowError";
  }
}
