'use client';
import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function CustomCursor() {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  // Raw mouse coordinates
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Smooth spring physics for trailing effect
  const springConfig = { damping: 30, stiffness: 400, mass: 0.4 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  // Tiny dot
  const dotX = useSpring(mouseX, { damping: 50, stiffness: 800 });
  const dotY = useSpring(mouseY, { damping: 50, stiffness: 800 });

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      mouseX.set(e.clientX - 10);
      mouseY.set(e.clientY - 10);
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      // Cheaper check than getComputedStyle
      const isInteractable = 
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.tagName === 'INPUT' ||
        target.closest('button') || 
        target.closest('a') || 
        target.closest('.glass-card') ||
        target.closest('.btn') ||
        target.style.cursor === 'pointer';

      if (isInteractable) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', moveCursor, { passive: true });
    window.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isVisible, mouseX, mouseY]);

  if (!isMounted) return null;

  return (
    <>
      <motion.div
        style={{
          position: 'fixed',
          top: 0, left: 0,
          x: cursorX, y: cursorY,
          width: 20, height: 20,
          borderRadius: '50%',
          border: '1px solid var(--rolex-gold)',
          pointerEvents: 'none',
          zIndex: 10000,
          mixBlendMode: 'difference',
          display: isVisible ? 'block' : 'none',
          backgroundColor: 'rgba(163, 126, 44, 0)', // Fix non-animatable transparent
        }}
        animate={{
          scale: isHovered ? 2.5 : 1,
          backgroundColor: isHovered ? 'rgba(163, 126, 44, 1)' : 'rgba(163, 126, 44, 0)',
          borderWidth: isHovered ? '0px' : '1px',
        }}
        transition={{ duration: 0.15 }}
      />
      <motion.div
        style={{
          position: 'fixed',
          top: 8, left: 8,
          x: dotX, y: dotY,
          width: 4, height: 4,
          borderRadius: '50%',
          backgroundColor: 'var(--rolex-gold)',
          pointerEvents: 'none',
          zIndex: 10001,
          display: isVisible && !isHovered ? 'block' : 'none',
        }}
      />
    </>
  );
}
