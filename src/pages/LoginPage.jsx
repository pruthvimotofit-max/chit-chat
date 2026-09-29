import { useState } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  isPhoneNumber,
  loginUser,
  sendPhoneLoginCode,
  verifyPhoneLoginCode,
} from "../services/auth/authService";

import { BRAND } from "../config/brand";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.74-.07-1.45-.2-2.13H12v4.03h5.24a4.48 4.48 0 0 1-1.95 2.94v2.45h3.15c1.84-1.69 2.91-4.18 2.91-7.29Z"
      />
      <path
        fill="#34A853"
        d="M12 21.8c2.63 0 4.84-.87 6.45-2.36l-3.15-2.45c-.87.58-1.98.93-3.3.93-2.54 0-4.69-1.72-5.46-4.03H3.29v2.53A9.75 9.75 0 0 0 12 21.8Z"
      />
      <path
        fill="#FBBC05"
        d="M6.54 13.89A5.87 5.87 0 0 1 6.23 12c0-.66.11-1.3.31-1.89V7.58H3.29A9.76 9.76 0 0 0 2.25 12c0 1.58.38 3.08 1.04 4.42l3.25-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.08c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.17 14.63 2.2 12 2.2a9.75 9.75 0 0 0-8.71 5.38l3.25 2.53C7.31 7.8 9.46 6.08 12 6.08Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.05 12.54c.02-2.16 1.76-3.2 1.84-3.25a3.95 3.95 0 0 0-3.12-1.69c-1.31-.14-2.58.78-3.25.78-.68 0-1.72-.76-2.83-.74a4.17 4.17 0 0 0-3.5 2.14c-1.5 2.61-.38 6.46 1.07 8.58.72 1.04 1.56 2.19 2.67 2.15 1.07-.04 1.48-.69 2.78-.69 1.29 0 1.66.69 2.78.67 1.16-.02 1.89-1.05 2.61-2.1.82-1.2 1.15-2.36 1.17-2.42-.03-.01-2.24-.86-2.22-3.43ZM14.92 6.21c.59-.71.98-1.7.87-2.69-.85.04-1.88.57-2.49 1.28-.54.62-1.01 1.63-.88 2.59.95.07 1.91-.48 2.5-1.18Z"
      />
    </svg>
  );
}

function getLoginErrorMessage(error) {
  if (error?.message === "INVALID_PHONE_NUMBER") {
    return "Please enter a valid phone number.";
  }

  if (error?.message === "PHONE_VERIFICATION_NOT_STARTED") {
    return "Please request a new verification code.";
  }

  if (
    error?.code === "auth/invalid-credential" ||
    error?.code === "auth/user-not-found" ||
    error?.code === "auth/wrong-password"
  ) {
    return "Incorrect email or password.";
  }

  if (error?.code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }

  if (error?.code === "auth/invalid-verification-code") {
    return "That verification code is incorrect.";
  }

  if (error?.code === "auth/code-expired") {
    return "That verification code has expired. Please request a new one.";
  }

  if (error?.code === "auth/too-many-requests") {
    return "Too many attempts. Please try again later.";
  }

  if (error?.code === "auth/network-request-failed") {
    return "Network error. Please check your internet connection.";
  }

  if (error?.code === "auth/quota-exceeded") {
    return "Phone verification is temporarily unavailable. Please try again later.";
  }

  return "Something went wrong. Please try again.";
}

function LoginPage() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [phoneVerification, setPhoneVerification] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError("");

    const value = identifier.trim();

    if (!value) {
      setServerError("Enter your email or phone number.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (phoneVerification) {
        if (!verificationCode.trim()) {
          setServerError("Enter the verification code.");
          return;
        }

        await verifyPhoneLoginCode(
          confirmationResult,
          verificationCode,
        );

        navigate("/", { replace: true });
        return;
      }

      if (isPhoneNumber(value)) {
        const result = await sendPhoneLoginCode(value);

        setConfirmationResult(result);
        setPhoneVerification(true);
        return;
      }

      if (!password) {
        setServerError("Enter your password.");
        return;
      }

      await loginUser(value, password);

      navigate("/", { replace: true });
    } catch (error) {
      console.error(error);
      setServerError(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToIdentifier() {
    setPhoneVerification(false);
    setConfirmationResult(null);
    setVerificationCode("");
    setServerError("");
  }

  const usingPhone = isPhoneNumber(identifier);

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-orb auth-orb-three" />

      <div className="auth-shell">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-mark">
              <span>CC</span>
            </div>

            <div className="auth-brand-copy">
              <h1>{BRAND.name}</h1>
              <p>
                {phoneVerification
                  ? "Verify your phone to continue"
                  : "A more personal way to connect"}
              </p>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {!phoneVerification ? (
              <>
                <div className="auth-field">
                  <label htmlFor="login-identifier">
                    Email or phone number
                  </label>

                  <input
                    id="login-identifier"
                    className="auth-input"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="you@example.com or 9876543210"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      setServerError("");
                    }}
                    disabled={isSubmitting}
                  />
                </div>

                {!usingPhone && (
                  <div className="auth-field">
                    <label htmlFor="login-password">Password</label>

                    <div className="auth-password-wrap">
                      <input
                        id="login-password"
                        className="auth-input"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setServerError("");
                        }}
                        disabled={isSubmitting}
                      />

                      <button
                        className="auth-password-toggle"
                        type="button"
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        onClick={() =>
                          setShowPassword((current) => !current)
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={18} strokeWidth={1.8} />
                        ) : (
                          <Eye size={18} strokeWidth={1.8} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="auth-code-message">
                  <span>Verification code sent to</span>
                  <strong>{identifier}</strong>
                </div>

                <div className="auth-field">
                  <label htmlFor="login-code">
                    Verification code
                  </label>

                  <input
                    id="login-code"
                    className="auth-input auth-code-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(event) => {
                      setVerificationCode(
                        event.target.value.replace(/\D/g, ""),
                      );
                      setServerError("");
                    }}
                    disabled={isSubmitting}
                  />
                </div>

                <button
                  className="auth-secondary-link"
                  type="button"
                  onClick={handleBackToIdentifier}
                  disabled={isSubmitting}
                >
                  Use a different email or phone number
                </button>
              </>
            )}

            {serverError && (
              <p className="auth-error" role="alert">
                {serverError}
              </p>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={isSubmitting}
            >
              <span>
                {isSubmitting
                  ? "Please wait..."
                  : phoneVerification
                    ? "Verify & log in"
                    : usingPhone
                      ? "Send verification code"
                      : "Log in"}
              </span>

              {!isSubmitting && (
                <ArrowRight size={17} strokeWidth={2.2} />
              )}
            </button>

            {!phoneVerification && !usingPhone && (
              <button
                className="auth-forgot"
                type="button"
                onClick={() => {}}
              >
                Forgot password?
              </button>
            )}
          </form>

          {!phoneVerification && (
            <>
              <div className="auth-divider">
                <span />
                <strong>OR</strong>
                <span />
              </div>

              <div className="auth-social-options">
                <button
                  type="button"
                  className="auth-social-button"
                >
                  <span className="auth-social-icon">
                    <GoogleIcon />
                  </span>
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  className="auth-social-button"
                >
                  <span className="auth-social-icon auth-apple-icon">
                    <AppleIcon />
                  </span>
                  <span>Continue with Apple</span>
                </button>
              </div>
            </>
          )}
        </section>

        {!phoneVerification && (
          <section className="auth-signup-card">
            <span>Don't have an account?</span>

            <button
              type="button"
              onClick={() => navigate("/signup")}
            >
              Create an account
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          </section>
        )}

        <footer className="auth-footer">
          <span className="auth-footer-dot" />
          <span>{BRAND.name}</span>
          <span className="auth-footer-dot" />
        </footer>
      </div>

      <div id="recaptcha-container" />
    </main>
  );
}

export default LoginPage;
