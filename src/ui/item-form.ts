import { t } from '../i18n';
import { addFile, addLink } from '../lib/items';
import { db } from '../lib/supabase';
import type { Item, ItemKind } from '../lib/types';
import { isFileSizeOk, normalizeLink } from '../lib/validate';
import { field, h } from './dom';
import { openModal } from './modal';
import { run } from './run';
import { state } from './store';
import type { ViewContext } from './view';

export function openItemForm(ctx: ViewContext): void {
  let kind: ItemKind = 'file';
  const fileInput = h('input', { type: 'file' });
  const urlInput = h('input', { type: 'text', inputmode: 'url', placeholder: 'https://…' });
  const titleInput = h('input', { type: 'text', maxlength: 200 });
  const categorySelect = h('select', {}, state.categories.map((c) => h('option', { value: c.id }, c.name)));
  const error = h('p', { class: 'form-error', role: 'alert' });
  const fileField = field(t('files.file'), fileInput);
  const urlField = field(t('files.url'), urlInput);
  urlField.hidden = true;

  const fileBtn = h('button', { type: 'button', class: 'seg-btn active', onclick: () => setKind('file') }, t('files.kindFile'));
  const linkBtn = h('button', { type: 'button', class: 'seg-btn', onclick: () => setKind('link') }, t('files.kindLink'));
  function setKind(next: ItemKind): void {
    kind = next;
    fileField.hidden = next !== 'file';
    urlField.hidden = next !== 'link';
    fileBtn.classList.toggle('active', next === 'file');
    linkBtn.classList.toggle('active', next === 'link');
    error.textContent = '';
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file && !titleInput.value) titleInput.value = file.name;
    error.textContent = file && !isFileSizeOk(file.size) ? t('error.too-big') : '';
  });

  const save = h('button', { class: 'btn', type: 'submit' }, t('files.add'));
  const form = h(
    'form',
    {
      class: 'form',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        error.textContent = '';
        const category_id = categorySelect.value;
        const added_by = state.meId as string;
        let action: () => Promise<Item>;
        if (kind === 'file') {
          const file = fileInput.files?.[0];
          if (!file) {
            error.textContent = t('files.pickFile');
            return;
          }
          if (!isFileSizeOk(file.size)) {
            error.textContent = t('error.too-big');
            return;
          }
          const title = titleInput.value.trim() || file.name;
          action = () => addFile(db, { category_id, title, file, fileName: file.name, added_by });
        } else {
          const url = normalizeLink(urlInput.value);
          if (!url) {
            error.textContent = t('error.bad-url');
            return;
          }
          const title = titleInput.value.trim() || url;
          action = () => addLink(db, { category_id, title, url, added_by });
        }
        save.disabled = true;
        save.textContent = t('files.uploading');
        const r = await run(action);
        save.disabled = false;
        save.textContent = t('files.add');
        if (r.ok || r.error.code === 'category-gone') {
          modal.close();
          await ctx.refresh();
        }
      },
    },
    h('div', { class: 'seg' }, fileBtn, linkBtn),
    fileField,
    urlField,
    field(t('files.title'), titleInput),
    field(t('files.category'), categorySelect),
    error,
    h('div', { class: 'modal-actions' }, save),
  );

  const modal = openModal(t('files.add'), form);
}
