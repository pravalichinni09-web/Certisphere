/**
 * showPdf — open a PDF inside the page (overlay with Download / Close)
 * instead of a new tab, so it works even where pop-up tabs are blocked.
 */
export const showPdf = (blob: Blob, fileName: string, title = fileName): void => {
  const url = URL.createObjectURL(blob);
  document.getElementById('cs-pdf-viewer')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cs-pdf-viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;padding:16px';

  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:12px;width:min(900px,100%);height:min(92vh,1100px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35)';

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #e2e8f0;font:600 14px system-ui,Arial,sans-serif;color:#0f172a';
  const name = document.createElement('span');
  name.textContent = title;
  name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

  const btn = (label: string, primary: boolean) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `padding:7px 14px;border-radius:8px;font:700 13px system-ui,Arial,sans-serif;cursor:pointer;${primary ? 'background:#166534;color:#fff;border:1px solid #166534' : 'background:#fff;color:#334155;border:1px solid #cbd5e1'}`;
    return b;
  };
  const dl = btn('Download', true);
  dl.dataset.testid = 'pdf-viewer-download';
  dl.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); };
  const close = btn('Close', false);
  const done = () => { overlay.remove(); document.removeEventListener('keydown', onKey); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') done(); };
  close.onclick = done;
  overlay.onclick = (e) => { if (e.target === overlay) done(); };
  document.addEventListener('keydown', onKey);

  const frame = document.createElement('iframe');
  frame.src = url;
  frame.title = title;
  frame.style.cssText = 'flex:1;border:0;width:100%;background:#f1f5f9';

  bar.append(name, dl, close);
  box.append(bar, frame);
  overlay.append(box);
  document.body.append(overlay);
};
