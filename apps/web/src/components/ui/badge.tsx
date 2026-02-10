import { cn } from '@/lib/utils';

const variantStyles = {
  default: 'border-transparent bg-primary text-primary-foreground shadow',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  destructive: 'border-transparent bg-destructive text-white shadow',
  outline: 'text-foreground',
  success: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  info: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
} as const;

type BadgeVariant = keyof typeof variantStyles;

function Badge({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'span'> & {
  variant?: BadgeVariant;
}) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
export type { BadgeVariant };
