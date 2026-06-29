'use client';

import QRCode from 'react-qr-code';

type TotpQrCodeProps = {
  uri: string;
  size?: number;
};

export function TotpQrCode({ uri, size = 192 }: TotpQrCodeProps) {
  return (
    <div className="mx-auto w-fit rounded-lg border bg-white p-4">
      <QRCode
        value={uri}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
        aria-label="QR code for authenticator app setup"
      />
    </div>
  );
}
