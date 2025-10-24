import type { AnchorHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type AnchorProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export const Anchor = (props: AnchorProps) => {
  const { children, className, ...rest } = props;

  return (
    <a className={cn('text-sm ', className)} {...rest} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};

Anchor.displayName = 'Anchor';