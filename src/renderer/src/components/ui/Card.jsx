import clsx from "clsx";
export default function Card({ className, children, hover = false, ...props }) {
  return <div className={clsx("aurora-card", hover && "is-interactive", className)} {...props}>{children}</div>;
}
