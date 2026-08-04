export interface CleaningArea {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CleaningAreaStatus {
  id: string;
  name: string;
  description?: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
}

export interface CleaningSummary {
  completedCount: number;
  totalCount: number;
  percentage: number;
}

export interface CleaningLog {
  id: string;
  cleaningAreaId: string;
  areaName: string;
  notes?: string | null;
  completedByName: string;
  completedAt: string;
}
