"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export default function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animation: number;

    const mouse = {
      x: -9999,
      y: -9999,
      radius: 200,
      isDown: false,
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();

    window.addEventListener("resize", resize);

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener("mousedown", () => {
      mouse.isDown = true;
    });

    window.addEventListener("mouseup", () => {
      mouse.isDown = false;
    });

    window.addEventListener("mouseleave", () => {
      mouse.x = -9999;
      mouse.y = -9999;
      mouse.isDown = false;
    });

    const particles: Particle[] = [];
    const COUNT = Math.floor((window.innerWidth * window.innerHeight) / 20000);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 1.5 + 1.5,
      });
    }

    // Pre-compute squared threshold — avoids Math.sqrt in the hot path
    const MAX_DIST = 180;
    const MAX_DIST_SQ = MAX_DIST * MAX_DIST;
    const MOUSE_RADIUS_SQ = mouse.radius * mouse.radius;

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── Draw all connection lines first (no shadow = cheaper GPU state) ──
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;          // no sqrt needed!
          if (distSq < MAX_DIST_SQ) {
            const alpha = (1 - Math.sqrt(distSq) / MAX_DIST) * 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(115,20,224,${alpha})`;
            ctx.stroke();
          }
        }
      }

      // ── Draw & update particles (glow applied once per node batch) ──
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#7314e0";
      ctx.fillStyle = "#7314e0";
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Mouse interaction — squared distance, no sqrt
        const dxMouse = mouse.x - p.x;
        const dyMouse = mouse.y - p.y;
        const mouseDistSq = dxMouse * dxMouse + dyMouse * dyMouse;
        if (mouseDistSq < MOUSE_RADIUS_SQ) {
          const mouseDist = Math.sqrt(mouseDistSq);
          if (mouse.isDown) {
            p.x += dxMouse * 0.03;
            p.y += dyMouse * 0.03;
          } else {
            p.x -= dxMouse * 0.005;
            p.y -= dyMouse * 0.005;
          }
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(115,20,224,${(1 - mouseDist / mouse.radius) * 0.8})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.shadowBlur = 12;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animation = requestAnimationFrame(draw);
    }

    // ── Pause RAF when tab is in background ──
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animation);
      } else {
        draw();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    draw();

    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Pure Black Background like the image */}
      <div className="absolute inset-0 bg-black" />

      {/* Canvas for Particles */}
      {/* pointer-events-auto allows the canvas to receive mouse events while the wrapper doesn't block underlying elements */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-auto"
      />
    </div>
  );
}