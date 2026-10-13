import clsx from "clsx";
import { forwardRef } from "react";
const Input = forwardRef(function Input({ className, icon, style, ...props }, ref) {
  return <div className="relative">
    {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50">{icon}</span>}
    <input ref={ref} className={clsx("aurora-input", className)} style={{ ...(icon ? { paddingLeft: 36 } : {}), ...style }} {...props} />
  </div>;
});
export default Input;
