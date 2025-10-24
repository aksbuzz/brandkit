import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type IconButtonVariant = 'default' | 'danger' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, variant = 'default', size = 'md', className, ...props }, ref) => {
    const baseStyles =
      'inline-flex cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variants: Record<IconButtonVariant, string> = {
      default: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-300',
      danger: 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500',
      ghost: 'text-gray-500 hover:bg-gray-100 focus:ring-gray-300',
    };

    const sizes: Record<IconButtonSize, string> = {
      sm: 'p-1',
      md: 'p-2',
      lg: 'p-3',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
