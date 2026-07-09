/**
 * ViewOnlyDoc — modal that displays an attached document inline.
 * Renders images natively, PDFs via <iframe>. NO download UI.
 */
import React from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  fileName?: string;
  dataUrl?: string;
}

const ViewOnlyDoc: React.FC<Props> = ({ open, onClose, title, fileName, dataUrl }) => {
  if (!open) return null;
  const lower = (fileName || dataUrl || '').toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower) || (dataUrl || '').startsWith('data:image');
  const isPdf   = /\.pdf$/i.test(lower) || (dataUrl || '').startsWith('data:application/pdf');

  return (
    <div className="cs-view-bd" onClick={onClose} role="dialog">
      <div className="cs-view-mb" onClick={(e) => e.stopPropagation()}>
        <header className="cs-view-hd">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="cs-view-body">
          {!dataUrl ? (
            <p className="cs-view-empty">No file attached.</p>
          ) : isImage ? (
            <img src={dataUrl} alt={fileName || title} draggable={false} />
          ) : isPdf ? (
            <iframe src={dataUrl} title={fileName || title} />
          ) : (
            <div className="cs-view-fallback">
              <p>Preview not available for this file type.</p>
              <p className="cs-view-name">{fileName || '—'}</p>
            </div>
          )}
        </div>
        <footer className="cs-view-ft">Read-only preview · downloads disabled</footer>
      </div>
    </div>
  );
};

export default ViewOnlyDoc;
