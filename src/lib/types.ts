export type Status = 'waiting' | 'taken' | 'finished';
export type ItemKind = 'file' | 'link';

export interface Member {
  id: string;
  name: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  position: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** 'YYYY-MM-DD' (Postgres date) or null */
  deadline: string | null;
  status: Status;
  taken_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface Item {
  id: string;
  category_id: string;
  kind: ItemKind;
  title: string;
  url: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  added_by: string;
  created_at: string;
}
