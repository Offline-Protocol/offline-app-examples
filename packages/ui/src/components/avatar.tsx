import { cn } from '../lib/utils';
import * as AvatarPrimitive from '@rn-primitives/avatar';

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn('border-foreground relative flex size-8 shrink-0 overflow-hidden rounded-md border-2', className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'bg-muted flex size-full flex-row items-center justify-center',
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback };
