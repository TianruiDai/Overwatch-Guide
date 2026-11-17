const shapes = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>',
  book: '<path d="M3 5c3-1 6-.6 9 1.5C15 4.4 18 4 21 5v14c-3-1-6-.6-9 1.5C9 18.4 6 18 3 19zM12 6.5v14"/>',
  settings: '<path d="m9.7 3-.7 2.1-1.5.9-2.2-.4-2.2 3.8 1.5 1.7v1.8l-1.5 1.7 2.2 3.8 2.2-.4 1.5.9.7 2.1h4.6l.7-2.1 1.5-.9 2.2.4 2.2-3.8-1.5-1.7v-1.8l1.5-1.7-2.2-3.8-2.2.4-1.5-.9-.7-2.1z"/><circle cx="12" cy="12" r="3"/>',
  harddrive: '<path d="m3 14 3-8h12l3 8"/><rect x="3" y="13" width="18" height="6" rx="2"/><path d="M6 16h1m8 0h3"/>',
  panels: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  x: '<path d="m6 6 12 12m0-12L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  upRight: '<path d="M6 18 18 6M8 6h10v10"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4"/>',
  video: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  playCircle: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
  shield: '<path d="m12 3 7 3v5c0 5-3.2 8.2-7 10-3.8-1.8-7-5-7-10V6z"/>',
  crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/>',
  heal: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  map: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link: '<path d="m9 15 6-6M8 17l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2-1 1-1a4 4 0 1 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  check: '<path d="m4 12 5 5 11-12"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 14h10l1-14m-8 3v8m4-8v8"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M8 1v4m8-4v4M8 19v4m8-4v4M1 8h4m-4 8h4m14-8h4m-4 8h4"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  export: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  note: '<path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8m-8 4h6"/>',
  bars: '<path d="M5 18v-4m5 4V9m5 9V5m5 13v-7"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
};
export function icon(name, size = 18) {
  return '<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + (shapes[name] || '') + '</svg>';
}
export function escapeHTML(v = '') {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  } [c]));
}
export const roleIcon = role => ({
  '重装': 'shield',
  '输出': 'crosshair',
  '支援': 'heal',
  '通用': 'layers'
} [role] || 'layers');
export function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-icon]').forEach(i => {
    i.outerHTML = icon(i.dataset.icon);
  });
}
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3200);
}
export function modal(title, content, setup) {
  const dialog = document.getElementById('dialog');
  if (dialog.open) dialog.close();
  dialog.setAttribute('aria-labelledby', 'modal-heading');
  dialog.innerHTML = '<header class="dialog-head"><h2 id="modal-heading">' + escapeHTML(title) + '</h2><button type="button" class="icon-button" data-close aria-label="关闭">' + icon('x') + '</button></header><div class="dialog-content">' + content + '</div>';
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.onclick = e => {
    if (e.target === dialog) {
      const b = dialog.getBoundingClientRect();
      if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) dialog.close();
    }
  };
  dialog.showModal();
  setup?.(dialog);
  return dialog;
}
export async function api(path, data, signal) {
  const res = await fetch('/api/' + path, data === undefined ? {
    signal
  } : {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data),
    signal
  });
  const payload = await res.json().catch(() => ({
    error: '工作台未能读取服务响应。'
  }));
  if (!res.ok || payload.error) throw new Error(payload.error || '请求失败，请重试。');
  return payload;
}
export const errorText = e => e?.name === 'QuotaExceededError' ? '设备存储空间不足。请导入较短的片段，或删除不再使用的录像。' : (e.message || '操作失败，请重试。');
export function localPrefs() {
  try {
    return JSON.parse(localStorage.getItem('owg:model') || '{}') || {};
  } catch {
    return {};
  }
}
