<script lang="ts">
  import { onMount } from "svelte";

  let count = $state(42);
  let previousDigits = $state("0042");
  let clicks = $state(0);
  const digits = $derived(String(count).padStart(4, "0"));

  onMount(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let interval: ReturnType<typeof setInterval> | undefined;

    function updateAnimation() {
      clearInterval(interval);
      interval = undefined;
      if (reducedMotion.matches || document.hidden) return;

      interval = setInterval(() => {
        previousDigits = digits;
        count = (count + 1) % 10000;
        clicks += 1;
      }, 2000);
    }

    updateAnimation();
    reducedMotion.addEventListener("change", updateAnimation);
    document.addEventListener("visibilitychange", updateAnimation);

    return () => {
      clearInterval(interval);
      reducedMotion.removeEventListener("change", updateAnimation);
      document.removeEventListener("visibilitychange", updateAnimation);
    };
  });
</script>

<figure class="m-0">
  <div class="relative">
    <svg
      viewBox="0 0 480 520"
      class="block h-auto w-full"
      role="img"
      aria-label="Chrome hand tally counter with four rolling number wheels"
      data-testid="tally-clicker"
      data-count={digits}
    >
      <defs>
        <linearGradient id="tally-chrome" x1="0" y1="0" x2="1" y2="0.7">
          <stop offset="0" stop-color="#f8fafc" />
          <stop offset="0.19" stop-color="#c1cbd0" />
          <stop offset="0.33" stop-color="#fff" />
          <stop offset="0.43" stop-color="#707d85" />
          <stop offset="0.48" stop-color="#e4eaed" />
          <stop offset="0.77" stop-color="#f8fafc" />
          <stop offset="1" stop-color="#8f9da5" />
        </linearGradient>
        <linearGradient id="tally-side" x1="0" y1="0" x2="1" y2="0.3">
          <stop stop-color="#73818a" />
          <stop offset="0.18" stop-color="#e2e8eb" />
          <stop offset="0.5" stop-color="#f8fafc" />
          <stop offset="0.84" stop-color="#c3cdd2" />
          <stop offset="1" stop-color="#7d8b94" />
        </linearGradient>
        <linearGradient id="tally-edge" x1="0" y1="0" x2="0.4" y2="1">
          <stop stop-color="#fafcfd" />
          <stop offset="0.27" stop-color="#87959e" />
          <stop offset="0.48" stop-color="#28343c" />
          <stop offset="0.55" stop-color="#f1f5f9" />
          <stop offset="1" stop-color="#99a6ae" />
        </linearGradient>
        <linearGradient id="tally-bezel" x1="0" y1="0" x2="0.3" y2="1">
          <stop stop-color="#4a535b" />
          <stop offset="0.55" stop-color="#22292f" />
          <stop offset="1" stop-color="#090e12" />
        </linearGradient>
        <linearGradient id="tally-wheel" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="#080c0f" />
          <stop offset="0.48" stop-color="#394047" />
          <stop offset="0.51" stop-color="#252c32" />
          <stop offset="1" stop-color="#080c0f" />
        </linearGradient>
        <linearGradient id="tally-lever" x1="0" y1="0" x2="0.8" y2="1">
          <stop stop-color="#fff" />
          <stop offset="0.5" stop-color="#e2e7e9" />
          <stop offset="0.85" stop-color="#a1adb4" />
          <stop offset="1" stop-color="#56636c" />
        </linearGradient>
        <radialGradient id="tally-knob">
          <stop stop-color="#eff3f5" />
          <stop offset="0.7" stop-color="#c8d1d6" />
          <stop offset="1" stop-color="#7c8a93" />
        </radialGradient>
        <radialGradient id="tally-shadow">
          <stop stop-color="#0f172a" stop-opacity="0.22" />
          <stop offset="1" stop-color="#0f172a" stop-opacity="0" />
        </radialGradient>
        {#each [0, 1, 2, 3] as position (position)}
          <clipPath id={`tally-digit-${position}`}>
            <rect x={36 + position * 49} y="45" width="44" height="65" rx="2" />
          </clipPath>
        {/each}
      </defs>

      <g aria-hidden="true">
        <ellipse cx="250" cy="477" rx="185" ry="25" fill="url(#tally-shadow)" />

        <!-- The loop sits behind the body and thumb lever. -->
        <path
          d="M140 183 L145 111 Q147 76 181 80 L302 100 Q332 105 330 136 L326 163"
          fill="none"
          stroke="#64717a"
          stroke-width="13"
        />
        <path
          d="M140 180 L147 111 Q149 82 180 85 L301 105 Q326 110 325 136 L322 158"
          fill="none"
          stroke="url(#tally-chrome)"
          stroke-width="8"
        />
        <path d="M300 102 Q323 88 337 111 L343 143 L312 153 Z" fill="#222b31" />
        <path
          d="M312 108 L326 112 L332 136"
          fill="none"
          stroke="#46525b"
          stroke-width="4"
        />

        <path
          d="M130 161 Q203 120 316 147 Q403 167 417 256 L406 366 Q396 427 338 455 Q309 471 268 460 L141 429 Q105 421 98 377 L89 267 Q86 196 130 161 Z"
          fill="url(#tally-chrome)"
          stroke="#7b8991"
          stroke-width="2"
        />
        <path
          d="M279 162 Q330 147 370 184 Q411 222 410 282 L399 365 Q391 424 335 451 Q306 465 278 453 Q246 436 244 391 L241 269 Q239 198 279 162 Z"
          fill="url(#tally-side)"
          stroke="#a2afb6"
          stroke-width="1.5"
        />
        <path
          d="M128 176 Q191 142 267 157 L315 170 Q277 178 262 216 L232 331 Q225 352 199 345 L100 316 L95 273 Q90 208 128 176 Z"
          fill="url(#tally-edge)"
        />
        <path
          d="M105 335 Q156 362 225 367"
          fill="none"
          stroke="#53616a"
          stroke-width="9"
        />
        <path
          d="M104 330 Q157 357 226 362"
          fill="none"
          stroke="#f8fafc"
          stroke-width="5"
        />
        <path
          d="M177 356 L187 414 Q190 435 201 443"
          fill="none"
          stroke="#8c9aa2"
          stroke-width="1.5"
        />
        <path
          d="M268 197 Q299 166 345 180"
          fill="none"
          stroke="#fff"
          stroke-opacity="0.85"
          stroke-width="5"
          stroke-linecap="round"
        />
        <path
          d="M278 420 Q296 444 323 439"
          fill="none"
          stroke="#fff"
          stroke-opacity="0.7"
          stroke-width="3"
          stroke-linecap="round"
        />

        {#key clicks}
          <g class:pressing={clicks > 0}>
            <path
              d="M190 175 L188 148 L216 144 L222 178"
              fill="url(#tally-edge)"
              stroke="#6c7a83"
              stroke-width="2"
            />
            <path
              d="M185 153 Q168 142 166 116 Q162 83 180 61 Q197 41 218 51 Q239 63 237 91 Q235 117 211 137 L216 155 Z"
              fill="url(#tally-lever)"
              stroke="#8c989f"
              stroke-width="2"
            />
            <path
              d="M173 113 Q169 82 187 64 Q198 53 211 56"
              fill="none"
              stroke="#fff"
              stroke-width="3"
              stroke-linecap="round"
            />
          </g>
        {/key}

        <g transform="matrix(1 0.18 -0.32 0.94 111 178)">
          <rect x="-3" y="-3" width="273" height="154" rx="7" fill="#a2adb4" />
          <rect
            width="267"
            height="148"
            rx="5"
            fill="url(#tally-bezel)"
            stroke="#111a21"
            stroke-width="4"
          />
          <path d="M5 5 H261 L233 34 H31 Z" fill="#626b72" opacity="0.55" />
          <path d="M5 5 L31 34 V118 L5 141 Z" fill="#78828a" opacity="0.35" />
          <rect
            x="29"
            y="36"
            width="208"
            height="83"
            rx="3"
            fill="#030608"
            stroke="#647079"
            stroke-width="1"
          />
          {#each digits.split("") as digit, position (position)}
            <rect
              x={36 + position * 49}
              y="45"
              width="44"
              height="65"
              rx="2"
              fill="url(#tally-wheel)"
            />
            <g clip-path={`url(#tally-digit-${position})`}>
              {#key digit}
                <g
                  class:rolling={clicks > 0 &&
                    digit !== previousDigits[position]}
                  class="number-wheel"
                >
                  <text x={58 + position * 49} y="96">{digit}</text>
                  {#if clicks > 0}
                    <text x={58 + position * 49} y="161"
                      >{previousDigits[position]}</text
                    >
                  {/if}
                </g>
              {/key}
            </g>
          {/each}
          <path
            d="M31 38 H235"
            stroke="#fff"
            stroke-opacity="0.25"
            stroke-width="2"
          />
          <path d="M7 143 H259" stroke="#65717a" stroke-width="2" />
        </g>

        <g transform="translate(354 291) rotate(12)">
          <ellipse cx="-8" cy="0" rx="25" ry="36" fill="#64727b" />
          <rect
            x="-8"
            y="-32"
            width="35"
            height="64"
            rx="8"
            fill="url(#tally-edge)"
            stroke="#8e9ba3"
          />
          {#each [0, 1, 2, 3, 4, 5] as ridge (ridge)}
            <path
              d={`M${-5 + ridge * 5} -29 l-6 10 6 10 -6 10 6 10 -6 10 6 9`}
              fill="none"
              stroke="#f8fafc"
              stroke-width="1.5"
              opacity="0.8"
            />
          {/each}
          <ellipse
            cx="29"
            cy="0"
            rx="20"
            ry="32"
            fill="url(#tally-knob)"
            stroke="#7c8a93"
            stroke-width="2"
          />
          <path
            d="M30 -26 Q47 -8 34 22"
            fill="none"
            stroke="#fff"
            stroke-width="3"
            opacity="0.8"
          />
          <path
            d="M18 18 Q24 9 35 6"
            fill="none"
            stroke="#53616a"
            stroke-width="5"
            stroke-linecap="round"
          />
        </g>

        {#each [{ x: 370, y: 222 }, { x: 315, y: 415 }] as screw (screw.y)}
          <g transform={`translate(${screw.x} ${screw.y}) rotate(18)`}>
            <ellipse
              rx="9"
              ry="13"
              fill="url(#tally-lever)"
              stroke="#8a979f"
              stroke-width="1.5"
            />
            <path
              d="M0 -7 V7 M-4 0 H4"
              stroke="#697780"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M-5 -7 Q-8 0 -4 7"
              fill="none"
              stroke="#fff"
              stroke-width="1.5"
            />
          </g>
        {/each}
      </g>
    </svg>
  </div>
  <figcaption
    class="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400"
  >
    A familiar click. A shared count.<br />
  </figcaption>
</figure>

<style>
  .number-wheel text {
    fill: #fff;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 53px;
    font-weight: 600;
    text-anchor: middle;
  }

  .rolling {
    animation: roll 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .pressing {
    animation: press 380ms ease-in-out;
    transform-origin: 204px 174px;
  }

  @keyframes roll {
    from {
      transform: translateY(-65px);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes press {
    40% {
      transform: translateY(5px) rotate(-4deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rolling,
    .pressing {
      animation: none;
    }
  }
</style>
