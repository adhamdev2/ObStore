"use client";

import dynamic from "next/dynamic";

// Must live in a Client Component — ssr:false is not allowed in Server Components
const ParticlesBackground = dynamic(
  () => import("./ParticlesBackground"),
  { ssr: false }
);

export default function ParticlesWrapper() {
  return <ParticlesBackground />;
}
