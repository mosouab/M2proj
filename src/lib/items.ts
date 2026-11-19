import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET, SIGNED_URL_SECONDS } from './constants';
import { AppError, requireRows } from './errors';
import type { Item } from './types';
import { fileNameFromPath, isFileSizeOk, normalizeLink, storagePathFor } from './validate';

const COLS = 'id,category_id,kind,title,url,storage_path,size_bytes,added_by,created_at';

export async function listItems(db: SupabaseClient): Promise<Item[]> {
  const { data, error } = await db.from('items').select(COLS).order('created_at', { ascending: false });
  if (error) throw error;
  return data as Item[];
}

export async function addLink(
  db: SupabaseClient,
  input: { category_id: string; title: string; url: string; added_by: string },
): Promise<Item> {
  const url = normalizeLink(input.url);
  if (!url) throw new AppError('bad-url');
  const { data, error } = await db
    .from('items')
    .insert({ ...input, url, title: input.title.trim() || url, kind: 'link' })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as Item;
}

/** Upload first, then insert the row; if the insert fails, try to remove the upload (may be refused for the team: harmless orphan). */
export async function addFile(
  db: SupabaseClient,
  input: { category_id: string; title: string; file: Blob; fileName: string; added_by: string },
  id: string = crypto.randomUUID(),
): Promise<Item> {
  if (!isFileSizeOk(input.file.size)) throw new AppError('too-big');
  const path = storagePathFor(input.fileName, id);
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type || 'application/octet-stream', upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await db
    .from('items')
    .insert({
      category_id: input.category_id,
      kind: 'file',
      title: input.title.trim() || input.fileName,
      storage_path: path,
      size_bytes: input.file.size,
      added_by: input.added_by,
    })
    .select(COLS)
    .single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data as Item;
}

export async function fileUrl(db: SupabaseClient, item: Item): Promise<string> {
  if (!item.storage_path) throw new AppError('unknown', 'item has no file');
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(item.storage_path, SIGNED_URL_SECONDS, { download: fileNameFromPath(item.storage_path) });
  if (error) throw error;
  return data.signedUrl;
}

/** Row first, then the stored object; a failed object removal only leaves an invisible orphan. */
export async function deleteItem(db: SupabaseClient, item: Item): Promise<void> {
  const { data, error } = await db.from('items').delete().eq('id', item.id).select('id');
  if (error) throw error;
  requireRows(data);
  if (item.storage_path) await db.storage.from(BUCKET).remove([item.storage_path]);
}
