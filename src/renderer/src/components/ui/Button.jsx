import clsx from "clsx";
export default function Button({ as: Tag = "button", variant = "primary", size = "md", className, children, ...props }) {
  return <Tag type={Tag === "button" ? "button" : undefined} className={clsx("aurora-button", `button-${variant}`, `button-${size}`, className)} {...props}>{children}</Tag>;
}
