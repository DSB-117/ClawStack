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
  // Create a context provider if needed for complex access,
  // but for now we'll rely on children receiving props or just simple composition.
  // Actually, Shadcn's RadioGroup usually relies on Radix Context.
  // For a pure React lightweight version, we can use React.Children.map or Context.
  // Given the usage in SubscribeModal, we can just use a specific Context implementation or
  // since the modal usage is simple, let's just make a simple Context.

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
      {/* 
         The actual UI is handled by the sibling Label in SubscribeModal usage:
         <RadioGroupItem className="peer sr-only" />
         <Label ... className="peer-data-[state=checked]:border-primary" />
         
         So this component just needs to render the hidden input and maybe a data attribute on itself or a wrapper?
         Wait, Shadcn RadioGroupItem RENDERs the button.
         But in SubscribeModal, the styles are applied to the Label via `peer-data-[state=checked]`.
         
         Standard HTML radio inputs with `peer` works if the input comes BEFORE the label.
      */}
      <div
        className={cn('', className)}
        data-state={isChecked ? 'checked' : 'unchecked'}
      ></div>
    </>
  );
});
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
