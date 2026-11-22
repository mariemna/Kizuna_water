/**
 * HydroMind — assets/nav.js
 * Sidebar navigation: active state management, click handling, and scroll spy.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.side-nav a');
    if (!navLinks.length) return;

    // Filter internal section links (href starting with #)
    const sectionLinks = Array.from(navLinks).filter(link => {
      const href = link.getAttribute('href');
      return href && href.startsWith('#');
    });

    const sections = [];
    sectionLinks.forEach(link => {
      const id = link.getAttribute('href').substring(1);
      const el = document.getElementById(id);
      if (el) {
        sections.push({ id, link, el });
      }
    });

    let isManualClick = false;
    let manualTimeout = null;

    function setActive(activeLink) {
      if (!activeLink) return;
      navLinks.forEach(link => {
        if (link === activeLink) {
          link.classList.add('active');
          link.setAttribute('aria-current', 'true');
        } else {
          link.classList.remove('active');
          link.removeAttribute('aria-current');
        }
      });
    }

    // Handle clicks on sidebar links
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          setActive(link);
          isManualClick = true;
          clearTimeout(manualTimeout);
          manualTimeout = setTimeout(() => {
            isManualClick = false;
          }, 800);
        }
      });
    });

    // Default on page load = Overview, or the item matching the URL #hash
    function initActive() {
      const hash = window.location.hash;
      let matchedLink = null;
      if (hash) {
        matchedLink = sectionLinks.find(link => link.getAttribute('href') === hash);
      }
      if (!matchedLink && sectionLinks.length > 0) {
        matchedLink = sectionLinks[0]; // Overview
      }
      if (matchedLink) {
        setActive(matchedLink);
      }
    }

    initActive();

    // Scroll spy: follow the scroll with IntersectionObserver
    const subSections = sections.filter(s => s.id !== 'overview');
    const overviewLink = sections.find(s => s.id === 'overview')?.link || sectionLinks[0];

    if ('IntersectionObserver' in window && subSections.length > 0) {
      const observerOptions = {
        root: null,
        rootMargin: '-15% 0px -50% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75]
      };

      const visibleEntries = new Map();

      const observer = new IntersectionObserver((entries) => {
        if (isManualClick) return;

        entries.forEach(entry => {
          visibleEntries.set(entry.target.id, entry);
        });

        // If user is near the very top of the page, activate overview
        if (window.scrollY < 180) {
          setActive(overviewLink);
          return;
        }

        // Find candidate with highest intersection ratio
        let bestCandidate = null;
        let maxRatio = 0;

        subSections.forEach(s => {
          const entry = visibleEntries.get(s.id);
          if (entry && entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            bestCandidate = s.link;
          }
        });

        // Fallback: check bounding rects for section in viewport
        if (!bestCandidate) {
          let closestDist = Infinity;
          subSections.forEach(s => {
            const rect = s.el.getBoundingClientRect();
            if (rect.top <= window.innerHeight * 0.65 && rect.bottom >= window.innerHeight * 0.15) {
              const dist = Math.abs(rect.top - 120);
              if (dist < closestDist) {
                closestDist = dist;
                bestCandidate = s.link;
              }
            }
          });
        }

        if (bestCandidate) {
          setActive(bestCandidate);
        } else if (window.scrollY < 300) {
          setActive(overviewLink);
        }
      }, observerOptions);

      subSections.forEach(s => observer.observe(s.el));

      // Scroll listener with debounce for top of page and fast scroll
      let scrollTimer = null;
      window.addEventListener('scroll', () => {
        if (isManualClick) return;
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          if (window.scrollY < 180) {
            setActive(overviewLink);
          }
        }, 50);
      }, { passive: true });
    }
  });
})();
