import { useState, useEffect, useRef } from 'react';

/**
 * Tracks which section is currently in the viewport using IntersectionObserver.
 * @param {string[]} sectionIds - Array of element IDs to observe
 * @returns {string|null} activeId - The ID of the currently visible section
 */
export function useActiveSection(sectionIds) {
  const [activeId, setActiveId] = useState(null);
  const ratioMapRef = useRef({});

  useEffect(() => {
    if (!sectionIds || sectionIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratioMapRef.current[entry.target.id] = entry.intersectionRatio;
        });

        // Find the section with the highest visibility ratio
        let bestId = null;
        let bestRatio = 0;

        Object.entries(ratioMapRef.current).forEach(([id, ratio]) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });

        if (bestId && bestRatio > 0) {
          setActiveId(bestId);
        }
      },
      {
        rootMargin: '-80px 0px -40% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}
