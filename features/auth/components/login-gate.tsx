"use client";

import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginBrand } from "@/features/auth/components/login-brand";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { loginWithOtp, requestAdminOtp } from "@/lib/cms/auth";

const phoneSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter the 10-digit admin phone number."),
  code: z.string(),
});
const verificationSchema = phoneSchema.extend({
  code: z.string().trim().min(1, "Enter the code you received."),
});
type SignInValues = z.infer<typeof phoneSchema>;

export function LoginGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(sent ? verificationSchema : phoneSchema),
    defaultValues: { phone: "", code: "" },
  });

  async function submit({ phone, code }: SignInValues) {
    setServerError("");
    try {
      if (!sent) {
        await requestAdminOtp(`+91${phone}`);
        setSent(true);
      } else {
        await loginWithOtp(`+91${phone}`, code.trim());
        onSignedIn();
      }
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : sent
            ? "Sign in failed."
            : "Could not send the code.",
      );
    }
  }

  return (
    <div className="login-gate">
      <div className="login-shell">
        <LoginBrand />
        <section className="login-main" aria-labelledby="login-title">
          <div className="login-mobile-brand">
            <Image
              src="/ryno-logo.png"
              width={112}
              height={52}
              alt="Ryno mobility"
              priority
            />
            <span>Operations workspace</span>
          </div>
          <div className="login-form-wrap">
            <div className="login-intro">
              <span className="login-intro-icon">
                <ShieldCheck size={20} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="login-eyebrow">RYNO OPERATIONS</span>
              <h1 id="login-title">Sign in</h1>
              <p>
                {sent
                  ? "Enter the one-time code sent to your phone."
                  : "Welcome back. Enter your admin phone number to continue."}
              </p>
            </div>
            <form
              className="login-card"
              method="post"
              onSubmit={handleSubmit(submit)}
              noValidate
            >
              <label>
                Admin phone number
                <span className="phone-field">
                  <span className="phone-prefix">+91</span>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="Enter your phone number"
                    maxLength={10}
                    {...register("phone")}
                    onChange={(event) =>
                      setValue(
                        "phone",
                        event.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    readOnly={sent}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "phone-error" : undefined}
                  />
                </span>
              </label>
              {errors.phone && (
                <div id="phone-error" className="inline-error" role="alert">
                  {errors.phone.message}
                </div>
              )}
              {sent && (
                <label>
                  One-time code
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    {...register("code")}
                    autoFocus
                    aria-invalid={!!errors.code}
                    aria-describedby={errors.code ? "code-error" : undefined}
                  />
                </label>
              )}
              {errors.code && (
                <div id="code-error" className="inline-error" role="alert">
                  {errors.code.message}
                </div>
              )}
              {serverError && (
                <div className="inline-error" role="alert">
                  {serverError}
                </div>
              )}
              <Button
                type="submit"
                className="login-submit"
                disabled={isSubmitting}
              >
                {isSubmitting && <Spinner />}
                {isSubmitting ? "Please wait…" : sent ? "Sign in" : "Send code"}
                {!isSubmitting && <ArrowRight size={17} aria-hidden="true" />}
              </Button>
              {sent && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setSent(false);
                    setValue("code", "");
                    clearErrors();
                    setServerError("");
                  }}
                >
                  Use a different number
                </button>
              )}
            </form>
            <p className="login-access-note">
              <ShieldCheck size={15} aria-hidden="true" /> For authorized Ryno
              team members
            </p>
          </div>
          <div className="login-main-footer">
            <span>Ryno mobility</span>
            <span>Operations workspace</span>
          </div>
        </section>
      </div>
    </div>
  );
}
