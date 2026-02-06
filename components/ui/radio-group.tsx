'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
// import { Circle } from "lucide-react"

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: string;
    onValueChange?: (value: string) => void;
  }
>(({ className, children, value, onValueChange, ...props }, ref) => {
  // Simple Context-based RadioGroup implementation

  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div className={cn('grid gap-2', className)} ref={ref} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
});
RadioGroup.displayName = 'RadioGroup';

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

const RadioGroupItem = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { value: string }
>(({ className, value, id, ...props }, ref) => {
  const context = React.useContext(RadioGroupContext);
  const isChecked = context.value === value;

  return (
    <>
      <input
        type="radio"
        className="sr-only"
        checked={isChecked}
        onChange={() => context.onValueChange?.(value)}
        value={value}
        id={id}
        ref={ref}
        {...props}
      />
      {/* Hidden input with data-state for peer styling */}
      <div
        className={cn('', className)}
        data-state={isChecked ? 'checked' : 'unchecked'}
      ></div>
    </>
  );
});
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
