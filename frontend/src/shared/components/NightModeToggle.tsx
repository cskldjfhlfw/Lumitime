import { cn } from '../lib/utils';

export function NightModeToggle({
  active,
  onToggle,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={event => {
        event.preventDefault();
        onToggle();
      }}
      className={cn('night-mode-toggle', active && 'night-mode-toggle--active', className)}
      aria-label={active ? '关闭夜间模式' : '开启夜间模式'}
      title={active ? '关闭夜间模式' : '开启夜间模式'}
    >
      <span className="night-mode-toggle__sky">
        <span className="night-mode-toggle__cloud night-mode-toggle__cloud--a" />
        <span className="night-mode-toggle__cloud night-mode-toggle__cloud--b" />
        <span className="night-mode-toggle__orb" />
        <span className="night-mode-toggle__star night-mode-toggle__star--a" />
        <span className="night-mode-toggle__star night-mode-toggle__star--b" />
        <span className="night-mode-toggle__star night-mode-toggle__star--c" />
      </span>
    </button>
  );
}
