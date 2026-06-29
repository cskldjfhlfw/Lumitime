import { motion } from 'motion/react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface PillNavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

interface PillNavProps {
  logo?: string;
  logoAlt?: string;
  brand?: ReactNode;
  items: PillNavItem[];
  activeHref?: string;
  className?: string;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  theme?: 'light' | 'dark';
  initialLoadAnimation?: boolean;
  onNavigate?: (href: string) => void;
}

export default function PillNav({
  logo,
  logoAlt = 'Logo',
  brand,
  items,
  activeHref,
  className,
  ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  baseColor = '#5f5a52',
  pillColor = '#171717',
  hoveredPillTextColor = '#ffffff',
  pillTextColor = '#ffffff',
  theme = 'light',
  initialLoadAnimation = false,
  onNavigate,
}: PillNavProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate(href);
  };

  return (
    <motion.div
      className={cn('pill-nav', theme === 'dark' && 'pill-nav--dark', className)}
      style={{
        '--pill-nav-base': baseColor,
        '--pill-nav-active': pillColor,
        '--pill-nav-active-text': pillTextColor,
        '--pill-nav-hover-text': hoveredPillTextColor,
        '--pill-nav-ease': ease,
      } as CSSProperties}
      initial={initialLoadAnimation ? { opacity: 0, y: -8, filter: 'blur(8px)' } : false}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {(brand || logo) && (
        <div className="pill-nav__brand">
          {brand || (
            <img src={logo} alt={logoAlt} className="pill-nav__logo" />
          )}
        </div>
      )}
      <div className="pill-nav__items" role="menubar" aria-label="主导航">
        {items.map(item => {
          const active = item.href === activeHref;
          return (
            <a
              key={item.href}
              href={`#${item.href}`}
              role="menuitem"
              aria-current={active ? 'page' : undefined}
              className={cn('pill-nav__item', active && 'pill-nav__item--active')}
              onClick={event => handleClick(event, item.href)}
            >
              {item.icon && <span className="pill-nav__icon">{item.icon}</span>}
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
    </motion.div>
  );
}
