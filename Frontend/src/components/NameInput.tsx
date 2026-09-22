import { color } from '../ui/theme.ts';
import { Field, Label } from '../ui/primitives.tsx';

type NameInputProps = {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  status: string;
  placeholder?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
};

// The username box, with its rule error and availability underneath. Used on
// the join screen and on the you screen. Same props as the app's version.
export default function NameInput({
  value,
  onChange,
  error,
  status,
  placeholder = 'type a name...',
  onEnter,
  autoFocus,
}: NameInputProps) {
  // one line under the box, never two: the rule that is broken, or what the
  // server said about the name once it isn't
  const free = status === 'available';
  const line = value && error ? error : status;

  return (
    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
      <Field
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        ariaLabel="name"
        autoFocus={autoFocus}
        maxLength={20}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onEnter) {
            onEnter();
          }
        }}
        style={{ width: '100%' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, minHeight: 15 }}>
        {line && !error && free ? (
          <span
            style={{ width: 5, height: 5, borderRadius: '50%', background: color.mint, flex: '0 0 auto' }}
          />
        ) : null}
        <Label style={{ color: value && error ? color.inkMuted : color.inkFaint }}>
          {line ? line.toUpperCase() : ''}
        </Label>
      </div>
    </div>
  );
}
