import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";
import { buttonClasses, type ButtonSize, type ButtonVariant, type IconType } from "./tokens";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconType;
  iconPosition?: "start" | "end";
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: Icon, iconPosition = "start", fullWidth, className, children, type, ...rest },
  ref,
) {
  const iconSize = size === "sm" ? 15 : 17;
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(buttonClasses(variant, size), fullWidth && "w-full", className)}
      {...rest}
    >
      {Icon && iconPosition === "start" ? <Icon size={iconSize} className="shrink-0" /> : null}
      {children ? <span className="command-label">{children}</span> : null}
      {Icon && iconPosition === "end" ? <Icon size={iconSize} className="shrink-0" /> : null}
    </button>
  );
});
