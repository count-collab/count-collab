<script lang="ts">
  import { browser } from "$app/environment";

  const { trigger = 0 }: { trigger: number } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  const COLORS = [
    "#22c55e",
    "#4ade80",
    "#86efac",
    "#fbbf24",
    "#fb923c",
    "#f472b6",
    "#a78bfa",
  ];

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    decay: number;
    color: string;
    size: number;
  }

  let particles: Particle[] = [];
  let raf: number | null = null;

  function spawn() {
    if (!canvas) return;
    // Random position in the right half, around where the "reached" label sits
    const cx = canvas.width * (0.55 + Math.random() * 0.35);
    const cy = canvas.height * (0.2 + Math.random() * 0.6);

    addBurst(cx, cy, 12);
    if (raf === null) animate();
  }

  function addBurst(cx: number, cy: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 1 + Math.random() * 2;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 1,
        decay: 0.012 + Math.random() * 0.01,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 1.5 + Math.random() * 1.5,
      });
    }
  }

  function animate() {
    if (!canvas) {
      raf = null;
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      raf = null;
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.vx *= 0.98;
      p.life -= p.decay;

      if (p.life <= 0) continue;
      alive++;

      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    if (alive > 0) {
      raf = requestAnimationFrame(animate);
    } else {
      particles = [];
      raf = null;
    }
  }

  function syncSize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  $effect(() => {
    const t = trigger;
    if (t > 0 && browser) {
      syncSize();
      spawn();
      setTimeout(spawn, 250);
      setTimeout(spawn, 550);
    }
  });

  $effect(() => {
    if (!browser || !canvas) return;

    syncSize();

    const observer = new ResizeObserver(syncSize);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  });
</script>

<canvas
  bind:this={canvas}
  class="absolute -inset-4 pointer-events-none"
  style="width: calc(100% + 2rem); height: calc(100% + 2rem);"
  aria-hidden="true"
></canvas>
