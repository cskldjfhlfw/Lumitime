import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export interface AnimatedListProps<T> {
  items: T[];
  keyForItem: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  onItemSelect?: (item: T, index: number) => void;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  displayScrollbar?: boolean;
  className?: string;
  itemClassName?: string;
}

export default function AnimatedList<T>({
  items,
  keyForItem,
  renderItem,
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = false,
  displayScrollbar = false,
  className,
  itemClassName,
}: AnimatedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  useEffect(() => {
    if (!enableArrowNavigation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
      const maxIndex = Math.max(0, items.length - 1);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex(index => {
          const next = Math.min(maxIndex, index + 1);
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex(index => {
          const next = Math.max(0, index - 1);
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
      }
      if (event.key === 'Enter' && items[activeIndex]) {
        onItemSelect?.(items[activeIndex], activeIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, enableArrowNavigation, items, onItemSelect]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'animated-list relative flex flex-col gap-3',
        showGradients && 'animated-list--gradients',
        displayScrollbar && 'animated-list--scrollbar',
        className,
      )}
    >
      {items.map((item, index) => (
        <motion.div
          key={keyForItem(item, index)}
          ref={node => { itemRefs.current[index] = node; }}
          className={cn(
            'animated-list__item',
            enableArrowNavigation && activeIndex === index && 'animated-list__item--active',
            itemClassName,
          )}
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2, margin: '0px 0px -8% 0px' }}
          transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.035, ease: [0.22, 0.8, 0.22, 1] }}
          onClick={() => onItemSelect?.(item, index)}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </div>
  );
}
