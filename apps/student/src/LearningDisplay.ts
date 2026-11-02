import { createContext } from 'react';
import type { PrivateLearnerMemory } from '../../../packages/shared/src/learning-engine';
export const LearningDisplay=createContext<PrivateLearnerMemory['preferences']>({});
