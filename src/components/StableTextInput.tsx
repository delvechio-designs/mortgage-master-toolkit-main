import * as React from "react";

/**
 * Input that preserves focus + caret across re-renders.
 * Works as a drop-in replacement for a plain <input>.
 */
export const StableTextInput = React.memo(function StableTextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  const ref = React.useRef<HTMLInputElement>(null);
  const wasFocused = React.useRef(false);
  const caret = React.useRef<{ start: number; end: number } | null>(null);

  // Before React updates: remember caret if we’re focused
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onBeforeInput = () => {
      if (document.activeElement === el) {
        wasFocused.current = true;
        try {
          caret.current = {
            start: el.selectionStart ?? 0,
            end: el.selectionEnd ?? 0,
          };
        } catch {
          // selection APIs can throw on some input types
        }
      }
    };

    el.addEventListener("beforeinput", onBeforeInput, true);
    return () => el.removeEventListener("beforeinput", onBeforeInput, true);
  }, []);

  // After React paints: if we lost focus, restore it (and caret)
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isActive = document.activeElement === el;
    if (wasFocused.current && !isActive) {
      el.focus({ preventScroll: true });
      try {
        if (caret.current) {
          el.setSelectionRange(caret.current.start, caret.current.end);
        } else {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      } catch {}
    }
    wasFocused.current = false;
    caret.current = null;
  });

  return <input ref={ref} {...props} />;
});
