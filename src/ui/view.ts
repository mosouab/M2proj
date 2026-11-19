export interface ViewContext {
  /** Reload everything from Supabase and re-render the current view. */
  refresh(): Promise<void>;
}
