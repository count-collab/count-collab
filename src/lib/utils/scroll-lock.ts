let locks = 0;
let previousOverflow = "";

/** Locks body scroll and returns the unlock function. Nested locks are ref-counted. */
export function lockBodyScroll(): () => void {
  if (locks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks--;
    if (locks === 0) document.body.style.overflow = previousOverflow;
  };
}
