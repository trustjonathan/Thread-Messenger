import { useState } from 'react';

interface Props {
  initialTitle: string;
  onSave: (title: string) => Promise<boolean>;
  onCancel: () => void;
}

export function GroupRenameForm({ initialTitle, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
      />
      <button
        type="button"
        disabled={saving}
        onClick={async () => { setSaving(true); await onSave(title.trim()); setSaving(false); }}
        className="px-3 rounded-xl bg-indigo-600 text-white min-h-[44px]"
      >
        Save
      </button>
      <button type="button" onClick={onCancel} className="px-3 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[44px]">
        Cancel
      </button>
    </div>
  );
}