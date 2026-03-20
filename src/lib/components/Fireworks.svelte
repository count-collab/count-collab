<script lang="ts">
  import { browser } from "$app/environment";

  const { trigger = 0 }: { trigger: number } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  const COLORS = [
    "#3b82f6",
    "#60a5fa",
    "#93c5fd",
    "#818cf8",
    "#a78bfa",
    "#f472b6",
    "#fb923c",
    "#fbbf24",
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
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.38;

    // Main burst
    addBurst(cx, cy, 30);
    // Two smaller side bursts for variety
    addBurst(cx - 40 + Math.random() * 80, cy - 20 + Math.random() * 40, 10);
    addBurst(cx - 40 + Math.random() * 80, cy - 20 + Math.random() * 40, 10);

    if (raf === null) animate();
  }

  function addBurst(cx: number, cy: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 1.5 + Math.random() * 3.5;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        decay: 0.012 + Math.random() * 0.012,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 2 + Math.random() * 2.5,
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
      p.vy += 0.06;
      p.vx *= 0.985;
      p.life -= p.decay;

      if (p.life <= 0) continue;
      alive++;

      ctx.globalAlpha = p.life * 0.8;
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

  // Watch for trigger changes
  $effect(() => {
    const t = trigger;
    if (t > 0 && browser) {
      syncSize();
      spawn();
    }
  });

  // Set up resize observer
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
  class="absolute inset-0 h-full w-full pointer-events-none"
  aria-hidden="true"
></canvas>
