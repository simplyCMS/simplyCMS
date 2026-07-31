import { Link, useLocation } from '@tanstack/react-router';
import { forwardRef } from 'react';
import { cn } from '../lib/utils';

interface NavLinkProps {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  exact?: boolean;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, to, exact, children, ...props }, ref) => {
    const { pathname } = useLocation();
    const isActive = exact ? pathname === to : pathname.startsWith(to);

    return (
      <Link
        ref={ref}
        {...props}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- маршрути ще не створені (Phase 2-4)
        to={to as any}
        className={cn(className, isActive && activeClassName)}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = 'NavLink';

export { NavLink };
export type { NavLinkProps };
