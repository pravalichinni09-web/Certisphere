import React, { useMemo } from 'react';
import { qrSvg } from '../utils/qrcode';

interface Props {
  text: string;
  size?: number;
  alt?: string;
}

const QrCodeView: React.FC<Props> = ({ text, size = 160, alt }) => {
  const html = useMemo(() => qrSvg(text || ' ', { size }), [text, size]);
  return (
    <span
      role="img"
      aria-label={alt || `QR code for ${text}`}
      style={{ display: 'inline-block', lineHeight: 0 }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default QrCodeView;
