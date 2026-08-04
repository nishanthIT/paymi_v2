export type EntrySlot = 'MORNING' | 'EVENING';
export type Compartment = 'FRIDGE' | 'FREEZER';

export interface Fridge {
  id: string;
  name: string;
  location?: string | null;
  minSafeTemp: number;
  maxSafeTemp: number;
  hasFreezer: boolean;
  freezerTargetTemp?: number | null;
  freezerMinSafeTemp?: number | null;
  freezerMaxSafeTemp?: number | null;
  isActive: boolean;
  createdAt: string;
  latestReading?: TemperatureLog | null;
}

export interface TemperatureLog {
  id: string;
  fridgeId: string;
  fridgeName?: string;
  temperature: string | number;
  entryType: EntrySlot;
  compartment: Compartment;
  notes?: string | null;
  recordedByName?: string;
  recordedAt: string;
  isAlert?: boolean;
  alertMessage?: string | null;
}

export interface FridgeTodayStatus {
  id: string;
  name: string;
  location?: string | null;
  minSafeTemp: number;
  maxSafeTemp: number;
  hasFreezer: boolean;
  freezerMinSafeTemp?: number | null;
  freezerMaxSafeTemp?: number | null;
  morningFridgeLogged: boolean;
  morningFridgeTemp?: number | null;
  eveningFridgeLogged: boolean;
  eveningFridgeTemp?: number | null;
  morningFreezerLogged: boolean;
  morningFreezerTemp?: number | null;
  eveningFreezerLogged: boolean;
  eveningFreezerTemp?: number | null;
}

export interface FridgeInput {
  name: string;
  location?: string;
  minSafeTemp?: number;
  maxSafeTemp?: number;
  hasFreezer?: boolean;
  freezerTargetTemp?: number;
  freezerMinSafeTemp?: number;
  freezerMaxSafeTemp?: number;
  isActive?: boolean;
}
