import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { TRACKS } from '../../data/tracks';
import {
  LockSimple,
  PencilSimple,
  CircleDashed,
  CaretLeft,
  CaretRight,
  ListBullets
} from '@phosphor-icons/react';

export const TrackSelector = () => {
  const navigate = useNavigate();
  const { activeTrackId, setActiveTrackId, submissions } = usePortal();
  const [isFloating, setIsFloating] = useState(false);
  const sentinelRef = useRef(null);
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Detect when scrolled past original position
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When sentinel scrolls above navbar (74px threshold)
        setIsFloating(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: '-78px 0px 0px 0px',
        threshold: 0
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Update scroll indicator arrows
  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // Center active track inside horizontal scroll when changed
  useEffect(() => {
    if (!scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector(`[data-track-id="${activeTrackId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    setTimeout(checkScroll, 250);
  }, [activeTrackId]);

  const handleScroll = (direction) => {
    if (!scrollRef.current) return;
    const offset = direction === 'left' ? -260 : 260;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    setTimeout(checkScroll, 300);
  };

  return (
    <>
      {/* Sentinel element to track scroll position */}
      <div ref={sentinelRef} style={{ height: '1px', marginTop: '-1px' }} />

      <div
        style={{
          position: 'sticky',
          top: '84px',
          zIndex: 40,
          background: isFloating ? 'rgba(255, 255, 255, 0.94)' : '#FFFFFF',
          backdropFilter: isFloating ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: isFloating ? 'blur(16px)' : 'none',
          borderRadius: '20px',
          border: isFloating
            ? '1.5px solid rgba(255, 95, 28, 0.25)'
            : '1px solid #ECECF1',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: isFloating
            ? '0 12px 32px -4px rgba(27, 29, 41, 0.12), 0 4px 12px rgba(255, 95, 28, 0.08)'
            : '0 2px 8px rgba(27, 29, 41, 0.03)',
          marginBottom: '28px',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Floating Indicator / Label when sticky */}
        {isFloating && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '12px',
              background: '#FFF1EB',
              color: '#FF5F1C',
              fontSize: '12.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <ListBullets size={15} weight="bold" />
            <span>เลือกหมวด</span>
          </div>
        )}

        {/* Scroll Left Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScroll('left')}
            aria-label="เลื่อนซ้าย"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#FFFFFF',
              border: '1px solid #ECECF1',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1B1D29',
              flexShrink: 0,
              zIndex: 2
            }}
          >
            <CaretLeft size={16} weight="bold" />
          </button>
        )}

        {/* Scrollable Track Buttons */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flex: 1,
            scrollBehavior: 'smooth'
          }}
        >
          {TRACKS.map(t => {
            const isActive = t.id === activeTrackId;
            const sub = submissions[t.id] || {};
            const isSubmitted = sub.status === 'submitted';
            const isDraft = sub.status === 'draft';

            return (
              <button
                key={t.id}
                data-track-id={t.id}
                onClick={() => {
                  setActiveTrackId(t.id);
                  navigate(`/submit/${t.id}`);
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '14px',
                  border: isActive ? '1.5px solid #FF5F1C' : '1.5px solid transparent',
                  background: isActive ? '#FF5F1C' : '#FAFAFC',
                  color: isActive ? '#FFFFFF' : '#1B1D29',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 700 : 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: isActive ? '0 4px 12px rgba(255, 95, 28, 0.3)' : 'none',
                  transition: 'all 0.18s ease'
                }}
              >
                <span>{t.th}</span>
                {isSubmitted ? (
                  <LockSimple size={13} weight="bold" color={isActive ? '#FFFFFF' : '#0A65B0'} />
                ) : isDraft ? (
                  <PencilSimple size={13} weight="bold" color={isActive ? '#FFFFFF' : '#D99A00'} />
                ) : (
                  <CircleDashed size={13} weight="bold" color={isActive ? '#FFFFFF' : '#A3A6B4'} />
                )}
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScroll('right')}
            aria-label="เลื่อนขวา"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#FFFFFF',
              border: '1px solid #ECECF1',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1B1D29',
              flexShrink: 0,
              zIndex: 2
            }}
          >
            <CaretRight size={16} weight="bold" />
          </button>
        )}
      </div>
    </>
  );
};
