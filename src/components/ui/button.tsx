// ============================================================
// Casa Quest — UI: Button
// Reusable button component with variants
// ============================================================

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm',
  secondary: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-500 shadow-sm',
  ghost: 'text-gray-600 hover:bg-gray-100',
  recovery: 'bg-orange-500 text-white hover:bg-orange-400 shadow-sm',
  auxilio: 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-sm',
  escalada: 'bg-purple-500 text-white hover:bg-purple-400 shadow-sm',
} as const;

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3.5 text-base rounded-xl',
  icon: 'p-2 rounded-lg',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
