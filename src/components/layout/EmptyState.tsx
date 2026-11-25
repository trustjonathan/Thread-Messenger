interface Props {
  className?: string;
}

export function EmptyState({ className = '' }: Props) {
  return (
    <div className={`m-auto px-6 text-center text-slate-500 ${className}`}>
      <p className="text-2xl font-light">Select a chat to start messaging</p>
    </div>
  );
}
