"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  images: string[];
  themeColor?: string;
  orgName: string;
}

export default function CoverCarousel({ images, themeColor, orgName }: Props) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent(prev => (prev + 1) % images.length), [images.length]);
  const prev = useCallback(() => setCurrent(prev => (prev - 1 + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, images.length]);

  return (
    <div className="relative h-[450px] w-full overflow-hidden bg-gray-900 border-b border-gray-200">
      {/* Overlay color */}
      <div className="absolute inset-0 opacity-50 mix-blend-multiply z-10" style={{ backgroundColor: themeColor || '#2563eb' }} />
      
      {/* Images */}
      {images.map((img, i) => (
        <img
          key={i}
          src={img}
          alt={`${orgName} cover ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === current ? 'opacity-50' : 'opacity-0'}`}
        />
      ))}

      {/* Arrows */}
      {images.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/20 hover:bg-black/40 text-white w-10 h-10 rounded-full flex items-center justify-center transition backdrop-blur-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/20 hover:bg-black/40 text-white w-10 h-10 rounded-full flex items-center justify-center transition backdrop-blur-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}

      {/* Dots */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/80'}`}
            />
          ))}
        </div>
      )}

      {/* Title */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="text-center px-4 max-w-4xl mx-auto mt-10">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight drop-shadow-xl mb-6">
            Benvenuti da {orgName}
          </h1>
          <p className="text-xl md:text-2xl text-gray-100 drop-shadow-md font-medium max-w-2xl mx-auto">
            Esplora la nostra collezione di proprietà esclusive e prenota online il tuo prossimo soggiorno.
          </p>
        </div>
      </div>
    </div>
  );
}
