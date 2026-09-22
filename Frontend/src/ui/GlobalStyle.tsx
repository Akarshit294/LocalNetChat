import { color, font } from './theme.ts';

// The one stylesheet in the app.
//
// style.md says inline styles only, keyframes excepted. Four more things can't
// be written inline at all, so they live here and nowhere else:
//   - @keyframes (the exception the guide already grants)
//   - ::placeholder
//   - :focus-visible, because a page you can't tab through isn't finished
//   - prefers-reduced-motion, because this page never stops moving otherwise
// GAP: style.md should say this out loud, or rule 6 reads as a ban on all four.
const css = `
  * { box-sizing: border-box; }

  html, body, #root { height: 100%; }

  body {
    margin: 0;
    background: ${color.bg};
    color: ${color.ink};
    font-family: ${font.mono};
    font-size: 13px;
    -webkit-font-smoothing: antialiased;
  }

  input, button, select, textarea { font: inherit; color: inherit; }

  ::placeholder { color: ${color.inkFaint}; opacity: 1; }

  :focus-visible {
    outline: 1px solid ${color.mint};
    outline-offset: 3px;
  }

  /* one token drifting: a small translate, never in step with its neighbours */
  @keyframes drift {
    from { transform: translate(0, 0); }
    to   { transform: translate(var(--dx), var(--dy)); }
  }

  /* presence and arrival only */
  @keyframes ping {
    from { transform: scale(.82); opacity: .5; }
    to   { transform: scale(2.15); opacity: 0; }
  }

  /* everything that appears does it this way */
  @keyframes reveal {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .001ms !important;
    }
  }
`;

export default function GlobalStyle() {
  return <style>{css}</style>;
}
