Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Stub Element.prototype.animate for Svelte transitions in JSDOM
if (typeof Element.prototype.animate !== "function") {
  Element.prototype.animate = () => {
    const anim = {
      onfinish: null as (() => void) | null,
      cancel: () => {},
      finish: () => {},
      play: () => {},
      pause: () => {},
      reverse: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      currentTime: 0,
      playbackRate: 1,
      playState: "finished",
      pending: false,
      ready: Promise.resolve(),
      finished: Promise.resolve(),
    } as unknown as Animation;

    // Auto-fire onfinish so Svelte transitions complete immediately
    queueMicrotask(() => {
      if (typeof anim.onfinish === "function") {
        (anim.onfinish as (ev: AnimationPlaybackEvent) => void)(
          new Event("finish") as AnimationPlaybackEvent,
        );
      }
    });

    return anim;
  };
}
