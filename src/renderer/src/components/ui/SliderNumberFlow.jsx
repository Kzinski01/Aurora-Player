import { useReducedMotion } from "framer-motion";
import NumberFlow from "@number-flow/react";
import * as RadixSlider from "@radix-ui/react-slider";
import clsx from "clsx";

// Adapted from https://21st.dev/@barvian/components/slider-number-flow —
// retinted from the reference's light/dark zinc+black palette to the app's
// own glass-on-accent language (see tailwind.config.js: base/accent/glow)
// so it reads as part of Aurora instead of a pasted-in demo. Track and thumb
// are translucent + blurred rather than solid, matching every other control
// surface in the app (.glass in index.css).
export default function SliderNumberFlow({ value, className, "aria-label": ariaLabel = "Valor", ...props }) {
  const reducedMotion = useReducedMotion();
  return (
    <RadixSlider.Root
      {...props}
      value={value}
      className={clsx("relative flex h-5 w-full touch-none select-none items-center", className)}
    >
      <RadixSlider.Track className="relative h-[3px] grow rounded-full bg-ink/10">
        <RadixSlider.Range className="absolute h-full rounded-full bg-gradient-to-r from-accent-deep to-accent" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        className="relative block h-3.5 w-3.5 rounded-full bg-accent border-2 border-base-800 shadow-sm transition-transform duration-150 ease-elegant hover:scale-110"
        aria-label={ariaLabel}
      >
        {value?.[0] != null && (
          <NumberFlow
            animated={!reducedMotion}
            willChange
            value={Math.round(value[0])}
            isolate
            continuous
            opacityTiming={{ duration: 250, easing: "ease-out" }}
            transformTiming={{
              easing:
                "linear(0, 0.0033 0.8%, 0.0263 2.39%, 0.0896 4.77%, 0.4676 15.12%, 0.5688, 0.6553, 0.7274, 0.7862, 0.8336 31.04%, 0.8793, 0.9132 38.99%, 0.9421 43.77%, 0.9642 49.34%, 0.9796 55.71%, 0.9893 62.87%, 0.9952 71.62%, 0.9983 82.76%, 0.9996 99.47%)",
              duration: 500,
            }}
            className="volume-value absolute -top-7 left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-ink/85"
          />
        )}
      </RadixSlider.Thumb>
    </RadixSlider.Root>
  );
}

export { SliderNumberFlow };
