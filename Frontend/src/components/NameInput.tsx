type NameInputProps = {
    value: string;
    onChange: (value: string) => void;
    error: string | null;
    status: string;
};

// The username box, with its rule error and availability status underneath.
// Used on the join screen and on the connected screen.
export default function NameInput({ value, onChange, error, status }: NameInputProps) {
    return (
        <>
            <input placeholder="Type user name..." value={value} onChange={(e) => onChange(e.target.value)} />
            {value && error && <p>{error}</p>}
            {status && <p>Username status: {status}</p>}
        </>
    );
}
