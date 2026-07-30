"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Grid } from "lucide-react";

export default function LightboxGallery({ photos }: { photos: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllGrid, setShowAllGrid] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const mainPhoto = photos.length > 0 ? photos[0].image_url : "https://placehold.co/1200x800?text=Nessuna+Foto";
  const sidePhotos = photos.slice(1, 5);

  const visibleSidePhotos = sidePhotos.filter(p => p?.image_url);
  const sidePlaceholders = Math.max(0, 4 - visibleSidePhotos.length);

  const renderMedia = (photo: any, onClick: () => void, className: string) => {
    if (photo.media_type === 'video') {
      return (
        <video
          src={photo.image_url}
          onClick={onClick}
          className={className}
          muted
          playsInline
        />
      );
    }
    return (
      <img
        src={photo.image_url}
        alt=""
        onClick={onClick}
        className={className}
      />
    );
  };

  // Esc key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeLightbox(); setShowAllGrid(false); }
      if (e.key === "ArrowRight") nextPhoto(e as any);
      if (e.key === "ArrowLeft") prevPhoto(e as any);
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const openLightbox = (index: number) => {
    if (photos.length === 0) return;
    setCurrentIndex(index);
    setIsOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setIsOpen(false);
    document.body.style.overflow = "auto";
  };

  const nextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextPhoto();
      else prevPhoto();
    }
  };

  return (
    <>
      <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[450px] mb-12 rounded-2xl overflow-hidden group">
        {/* Main photo — spans 2 cols x 2 rows on left */}
        <div className="col-span-2 row-span-2 relative overflow-hidden bg-gray-100">
          {renderMedia(photos[0], () => openLightbox(0), "w-full h-full object-cover cursor-pointer hover:brightness-110 transition-all duration-300")}
        </div>
        {/* Right side: 2x2 grid + button overlay */}
        <div className="col-span-2 row-span-2 relative overflow-hidden">
          <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full">
            {visibleSidePhotos[0] && (
              <div className="relative overflow-hidden bg-gray-100">
                {renderMedia(visibleSidePhotos[0], () => openLightbox(1), "w-full h-full object-cover cursor-pointer hover:brightness-110 transition-all duration-300")}
              </div>
            )}
            {sidePlaceholders >= 3 && <div className="bg-gray-100" />}
            {visibleSidePhotos[1] && (
              <div className="relative overflow-hidden bg-gray-100">
                {renderMedia(visibleSidePhotos[1], () => openLightbox(2), "w-full h-full object-cover cursor-pointer hover:brightness-110 transition-all duration-300")}
              </div>
            )}
            {sidePlaceholders >= 2 && <div className="bg-gray-100" />}
            {visibleSidePhotos[2] && (
              <div className="relative overflow-hidden bg-gray-100">
                {renderMedia(visibleSidePhotos[2], () => openLightbox(3), "w-full h-full object-cover cursor-pointer hover:brightness-110 transition-all duration-300")}
              </div>
            )}
            {sidePlaceholders >= 1 && <div className="bg-gray-100" />}
            {visibleSidePhotos[3] && (
              <div className="relative overflow-hidden bg-gray-100">
                {renderMedia(visibleSidePhotos[3], () => openLightbox(4), "w-full h-full object-cover cursor-pointer hover:brightness-110 transition-all duration-300")}
              </div>
            )}
          </div>
          {/* Show all photos button */}
          {photos.length > 1 && (
            <button
              onClick={() => { setShowAllGrid(true); document.body.style.overflow = "hidden"; }}
              className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-white flex items-center gap-2 transition z-10"
            >
              <Grid className="w-4 h-4" /> Vedi tutte le {photos.length} foto
            </button>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden relative aspect-[4/3] mb-8 rounded-2xl overflow-hidden">
        {photos[0]?.media_type === 'video' ? (
          <video src={photos[0].image_url} onClick={() => openLightbox(0)} className="w-full h-full object-cover cursor-pointer" muted playsInline />
        ) : (
          <img src={mainPhoto} alt="Foto principale" onClick={() => openLightbox(0)} className="w-full h-full object-cover cursor-pointer" />
        )}
        {photos.length > 1 && (
          <button
            onClick={() => { setShowAllGrid(true); document.body.style.overflow = "hidden"; }}
            className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-white flex items-center gap-2 transition"
          >
            <Grid className="w-4 h-4" /> Vedi tutte le {photos.length} foto
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black bg-opacity-95 flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="absolute top-4 right-4 z-50">
            <button onClick={closeLightbox} className="text-white hover:bg-white/20 p-2 rounded-full transition">
              <X className="w-8 h-8" />
            </button>
          </div>
          
          <div className="absolute top-4 left-4 text-white text-sm font-medium z-50 bg-black/50 px-3 py-1 rounded-full">
            {currentIndex + 1} / {photos.length}
          </div>

          <button onClick={prevPhoto} className="absolute left-4 sm:left-10 text-white hover:bg-white/20 p-3 rounded-full transition z-50">
            <ChevronLeft className="w-10 h-10" />
          </button>
          
          <div
            className="relative w-full h-full max-w-5xl max-h-[85vh] flex items-center justify-center p-4"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {photos[currentIndex]?.media_type === 'video' ? (
              <video
                key={currentIndex}
                src={photos[currentIndex].image_url}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain select-none animate-in fade-in zoom-in-[0.98] duration-200"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={currentIndex}
                src={photos[currentIndex].image_url}
                alt={`Foto ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain select-none animate-in fade-in zoom-in-[0.98] duration-200"
              />
            )}
          </div>

          <button onClick={nextPhoto} className="absolute right-4 sm:right-10 text-white hover:bg-white/20 p-3 rounded-full transition z-50">
            <ChevronRight className="w-10 h-10" />
          </button>
        </div>
      )}

      {/* Full gallery grid modal */}
      {showAllGrid && (
        <div className="fixed inset-0 z-[100] bg-white animate-in fade-in duration-200 flex flex-col">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Tutte le foto ({photos.length})</h2>
            <button onClick={() => { setShowAllGrid(false); document.body.style.overflow = "auto"; }} className="p-2 hover:bg-gray-100 rounded-full transition">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
              {photos.map((photo, i) => (
                <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all" onClick={() => { setShowAllGrid(false); openLightbox(i); }}>
                  {photo.media_type === 'video' ? (
                    <video src={photo.image_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
