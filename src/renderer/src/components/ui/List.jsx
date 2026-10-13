import { AnimatePresence } from "framer-motion";
import clsx from "clsx";

export default function List({ children, className }) {
  return (
    <div className={clsx("flex flex-col gap-2.5", className)}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  );
}
