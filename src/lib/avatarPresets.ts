export interface AvatarPreset {
  id: string;
  label: string;
  seed: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'default', label: 'Default', seed: '' },
  { id: 'avatar-1', label: 'Aurora', seed: 'aurora' },
  { id: 'avatar-2', label: 'Basil', seed: 'basil' },
  { id: 'avatar-3', label: 'Cedar', seed: 'cedar' },
  { id: 'avatar-4', label: 'Dahlia', seed: 'dahlia' },
  { id: 'avatar-5', label: 'Ember', seed: 'ember' },
  { id: 'avatar-6', label: 'Fern', seed: 'fern' },
  { id: 'avatar-7', label: 'Glacier', seed: 'glacier' },
  { id: 'avatar-8', label: 'Hazel', seed: 'hazel' },
  { id: 'avatar-9', label: 'Iris', seed: 'iris' },
  { id: 'avatar-10', label: 'Jasper', seed: 'jasper' },
  { id: 'avatar-11', label: 'Koa', seed: 'koa' },
  { id: 'avatar-12', label: 'Linden', seed: 'linden' },
  { id: 'avatar-13', label: 'Marlow', seed: 'marlow' },
  { id: 'avatar-14', label: 'Nixie', seed: 'nixie' },
  { id: 'avatar-15', label: 'Orion', seed: 'orion' },
  { id: 'avatar-16', label: 'Poppy', seed: 'poppy' },
  { id: 'avatar-17', label: 'Quill', seed: 'quill' },
  { id: 'avatar-18', label: 'Rowan', seed: 'rowan' },
  { id: 'avatar-19', label: 'Sage', seed: 'sage' },
  { id: 'avatar-20', label: 'Tansy', seed: 'tansy' },
  { id: 'avatar-21', label: 'Una', seed: 'una' },
  { id: 'avatar-22', label: 'Vale', seed: 'vale' },
  { id: 'avatar-23', label: 'Wren', seed: 'wren' },
  { id: 'avatar-24', label: 'Yara', seed: 'yara' },
];

export function getAvatarPreset(id: string | undefined): AvatarPreset {
  if (!id) return AVATAR_PRESETS[0];
  return AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0];
}
