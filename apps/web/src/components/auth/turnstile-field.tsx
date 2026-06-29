'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import type { RefObject } from 'react';
import { isTurnstileEnabled, turnstileSiteKey } from '@/lib/turnstile';

type TurnstileFieldProps = {
  onTokenChange: (token: string | null) => void;
  widgetRef?: RefObject<TurnstileInstance | null>;
};

export function TurnstileField({ onTokenChange, widgetRef }: TurnstileFieldProps) {
  if (!isTurnstileEnabled) {
    return null;
  }

  return (
    <div className="flex justify-center">
      <Turnstile
        ref={widgetRef}
        siteKey={turnstileSiteKey}
        onSuccess={(token) => onTokenChange(token)}
        onExpire={() => {
          onTokenChange(null);
          widgetRef?.current?.reset();
        }}
        onError={() => {
          onTokenChange(null);
        }}
        options={{
          theme: 'auto',
          size: 'flexible',
        }}
      />
    </div>
  );
}
