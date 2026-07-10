import { DealerApplicationForm } from "@/components/auth/DealerApplicationForm";
import { RecaptchaV3Script } from "@/components/auth/RecaptchaV3Script";
import { RegisterRecaptchaEnvCheck } from "@/components/auth/RegisterRecaptchaEnvCheck";
import { RECAPTCHA_SITE_KEY } from "@/lib/recaptcha-constants";

export default function RegisterPage() {
  return (
    <>
      <RegisterRecaptchaEnvCheck siteKey={RECAPTCHA_SITE_KEY} />
      <RecaptchaV3Script />
      <DealerApplicationForm />
    </>
  );
}
