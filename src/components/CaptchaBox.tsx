'use client';

import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { CaptchaProvider } from '@/lib/config';

type CaptchaBoxProps = {
  provider: CaptchaProvider;
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
};

export type CaptchaBoxHandle = {
  reset: () => void;
};

function CaptchaBoxInner({ provider, siteKey, onVerify, onExpire }: CaptchaBoxProps, ref: React.Ref<CaptchaBoxHandle>) {
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const hcaptchaRef = useRef<HCaptcha>(null);

  useImperativeHandle(ref, () => ({
    reset() {
      turnstileRef.current?.reset();
      hcaptchaRef.current?.resetCaptcha();
    },
  }));

  if (provider === 'none') {
    return null;
  }

  if (!siteKey) {
    return <div className="notice error">验证码站点密钥未配置。</div>;
  }

  if (provider === 'turnstile') {
    return (
      <div className="captcha-box">
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={onVerify}
          onExpire={onExpire}
          onError={() => onExpire?.()}
        />
      </div>
    );
  }

  return (
    <div className="captcha-box">
      <HCaptcha ref={hcaptchaRef} sitekey={siteKey} onVerify={onVerify} onExpire={onExpire} onError={() => onExpire?.()} />
    </div>
  );
}

const CaptchaBox = forwardRef(CaptchaBoxInner);
export default CaptchaBox;
