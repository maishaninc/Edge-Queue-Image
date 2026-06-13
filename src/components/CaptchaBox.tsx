'use client';

import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Turnstile } from '@marsidev/react-turnstile';
import type { CaptchaProvider } from '@/lib/config';

type CaptchaBoxProps = {
  provider: CaptchaProvider;
  siteKey: string;
  onVerify: (token: string) => void;
};

export default function CaptchaBox({ provider, siteKey, onVerify }: CaptchaBoxProps) {
  if (provider === 'none') {
    return null;
  }

  if (!siteKey) {
    return <div className="notice error">验证码站点密钥未配置。</div>;
  }

  if (provider === 'turnstile') {
    return (
      <div className="captcha-box">
        <Turnstile siteKey={siteKey} onSuccess={onVerify} />
      </div>
    );
  }

  return (
    <div className="captcha-box">
      <HCaptcha sitekey={siteKey} onVerify={onVerify} />
    </div>
  );
}
