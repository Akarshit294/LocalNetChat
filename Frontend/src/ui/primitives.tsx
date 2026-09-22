import type { CSSProperties, ReactNode } from 'react';
import { useHover, useNarrow } from './hooks.ts';
import { color, panelShadow, radius, size, stageDots, stageWash, type } from './theme.ts';

// The pieces every page is built from. No page writes a colour or a radius of
// its own; if something isn't here, it isn't in the design.

export function Page({ children }: { children: ReactNode }) {
  const narrow = useNarrow();
  return (
    <main
      style={{
        maxWidth: size.pageWidth,
        margin: '0 auto',
        padding: narrow ? size.pagePadNarrow : size.pagePad,
        display: 'flex',
        flexDirection: 'column',
        gap: narrow ? 24 : size.panelGap,
      }}
    >
      {children}
    </main>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const narrow = useNarrow();
  return (
    <section
      style={{
        background: color.panel,
        border: `1px solid ${color.hair}`,
        borderRadius: radius.panel,
        padding: narrow ? size.panelPadNarrow : size.panelPad,
        boxShadow: panelShadow,
        animation: 'reveal .22s ease-out backwards',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

// Route name on top, one line of mono meta under it, a right-aligned uppercase
// hint about the interaction. That is the whole chrome a panel gets.
export function PanelHeader({
  route,
  meta,
  hint,
}: {
  route: string;
  meta?: ReactNode;
  hint?: ReactNode;
}) {
  const narrow = useNarrow();
  return (
    <header
      style={{
        display: 'flex',
        flexDirection: narrow ? 'column' : 'row',
        alignItems: 'flex-start',
        gap: narrow ? 8 : 20,
        marginBottom: 18,
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={type.title}>{route}</div>
        {meta ? <div style={{ ...type.meta, marginTop: 5 }}>{meta}</div> : null}
      </div>
      {hint ? (
        <div
          style={{
            ...type.label,
            textAlign: narrow ? 'left' : 'right',
            paddingTop: narrow ? 0 : 4,
            whiteSpace: narrow ? 'normal' : 'nowrap',
          }}
        >
          {hint}
        </div>
      ) : null}
    </header>
  );
}

// The lit, dotted area inside a panel. Anything spatial happens in one of these,
// and an empty one is what loading looks like.
export function Stage({
  children,
  height,
  style,
  scrollRef,
}: {
  children?: ReactNode;
  height?: number | string;
  style?: CSSProperties;
  // for a stage that scrolls, so the owner can keep it at the bottom
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={scrollRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height,
        border: `1px solid ${color.hair}`,
        borderRadius: radius.stage,
        backgroundImage: `${stageDots}, ${stageWash}`,
        backgroundSize: '28px 28px, auto',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// A strip of paper inside a panel: the composer, the member list, a form row.
export function Bar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: color.paper,
        border: `1px solid ${color.hair}`,
        borderRadius: radius.bar,
        padding: '14px 16px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...type.label, ...style }}>{children}</div>;
}

export function Meta({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...type.meta, ...style }}>{children}</div>;
}

// Actions on a row appear on hover as one of these. Never a row of buttons.
export function Chip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: radius.chip,
        background: color.mintDeep,
        color: '#fff',
        fontSize: 11.5,
        letterSpacing: '.06em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'quiet';
  style?: CSSProperties;
  title?: string;
};

// A real button, for committing a form. Per-row actions use a Chip instead.
export function Button({ children, onClick, disabled, kind = 'primary', style, title }: ButtonProps) {
  const { hovered, bind } = useHover();
  const primary = kind === 'primary';
  const lit = hovered && !disabled;
  return (
    <button
      {...bind}
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 11.5,
        letterSpacing: '.12em',
        padding: '9px 15px',
        borderRadius: radius.button,
        border: `1px solid ${primary ? color.mintDeep : color.hair}`,
        background: primary ? color.mintDeep : color.paper,
        color: primary ? '#fff' : color.ink,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        // the same mint halo the "you" ring uses, so hover speaks one language
        boxShadow: lit ? '0 0 0 4px oklch(72% 0.09 165 / .16)' : 'none',
        transition: 'box-shadow .22s ease-out, opacity .22s ease-out',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  maxLength?: number;
  style?: CSSProperties;
  autoFocus?: boolean;
  ariaLabel?: string;
};

export function Field({
  value,
  onChange,
  placeholder,
  onKeyDown,
  maxLength,
  style,
  autoFocus,
  ariaLabel,
}: FieldProps) {
  return (
    <input
      value={value}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      style={{
        flex: '1 1 auto',
        minWidth: 0,
        fontSize: 13,
        letterSpacing: '.01em',
        color: color.ink,
        background: color.paper,
        border: `1px solid ${color.hair}`,
        borderRadius: radius.button,
        padding: '9px 11px',
        outlineOffset: 2,
        ...style,
      }}
    />
  );
}

// GAP: style.md has nothing for a select. It is a Field that opens.
export function Select({
  value,
  onChange,
  children,
  style,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      style={{
        fontSize: 12,
        letterSpacing: '.02em',
        color: color.ink,
        background: color.paper,
        border: `1px solid ${color.hair}`,
        borderRadius: radius.button,
        padding: '8px 10px',
        maxWidth: 200,
        ...style,
      }}
    >
      {children}
    </select>
  );
}
