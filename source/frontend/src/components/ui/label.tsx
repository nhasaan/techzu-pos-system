import * as React from 'react';
import { cn } from '../../lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      // Block with a 24px line box: Tailwind 4's space-y-* spaces children with margin-bottom, which
      // inline labels ignore. Under Tailwind 3 the inline label sat in the parent's 24px line box, so
      // leading-6 keeps label-to-field spacing identical to before.
      'block text-sm font-medium leading-6 peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className
    )}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
