import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { btnSecondary } from '../styles/ui';

interface ActionsMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ActionsMenuProps {
  label: string;
  ariaLabel: string;
  actions: ActionsMenuItem[];
}

// Renders the dropdown panel via a portal (fixed-positioned from the trigger's
// bounding rect) so it isn't clipped by ancestor `overflow-hidden` containers
// like the table shell this is used inside.
export function ActionsMenu({ label, ariaLabel, actions }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 6, left: rect.right });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const handleDismiss = () => close();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? close() : openMenu())}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={btnSecondary}
      >
        {label}
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: position.top, left: position.left, transform: 'translateX(-100%)' }}
            className="z-50 w-44 overflow-hidden rounded-2xl border border-tan/15 bg-white py-1 shadow-warm"
          >
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  action.onClick();
                }}
                className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-sand/60 ${
                  action.danger ? 'text-red-600' : 'text-ink'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
