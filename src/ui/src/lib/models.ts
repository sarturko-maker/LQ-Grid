import type { ModelOption } from '@/types';

export const MODELS: ModelOption[] = [
  {
    id: 'sonnet',
    name: 'Sonnet',
    description: 'Fast and capable — best for most reviews',
  },
  {
    id: 'opus',
    name: 'Opus',
    description: 'Deepest reasoning — complex provisions',
  },
  {
    id: 'haiku',
    name: 'Haiku',
    description: 'Fastest — simple extractions at scale',
  },
];

export const DEFAULT_MODEL = 'sonnet';
