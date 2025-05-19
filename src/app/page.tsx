"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// TODOS: Add what we do in columns under the hero. Custom rings, pendants, earrings, luxury watches
// Success stories


const heroImages = [
  "/images/hero/hero1.png",
  "/images/hero/hero2.png",
  "/images/hero/hero4.png",
  "/images/hero/hero3.png"
];

export default function Home() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <section className="relative w-full h-[60vh] overflow-hidden max-w-[70vw] m-auto">
        <Image
          src={heroImages[current]}
          alt="Luxury Jewelry Hero"
          fill
          className="object-cover transition-opacity duration-1000"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="text-center text-white px-6">
            <h2 className="text-4xl md:text-5xl font-bold mb-2">Timeless Luxury, Handcrafted</h2>
            <p className="text-lg max-w-xl mx-auto">Experience the elegance and craftsmanship of our bespoke jewelry pieces, created to capture your most meaningful moments.</p>
          </div>
        </div>
      </section>
    </div>
  );
}