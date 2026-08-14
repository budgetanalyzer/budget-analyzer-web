// src/components/ui/Checkbox.tsx
import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(
  (
    {
      className,
      checked,
      defaultChecked,
      required,
      onCheckedChange,
      name,
      form,
      disabled,
      value,
      ...props
    },
    ref,
  ) => (
    <CheckboxPrimitive.unstable_Provider
      checked={checked}
      defaultChecked={defaultChecked}
      required={required}
      onCheckedChange={onCheckedChange}
      name={name}
      form={form}
      disabled={disabled}
      value={value}
    >
      <CheckboxPrimitive.unstable_Trigger
        ref={ref}
        className={cn(
          'group peer flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
          className,
        )}
        {...props}
      >
        <span className="pointer-events-none flex items-center justify-center text-current">
          <Minus className="hidden h-3 w-3 group-data-[state=indeterminate]:block" />
          <Check className="hidden h-3 w-3 group-data-[state=checked]:block" />
        </span>
      </CheckboxPrimitive.unstable_Trigger>
    </CheckboxPrimitive.unstable_Provider>
  ),
);

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
