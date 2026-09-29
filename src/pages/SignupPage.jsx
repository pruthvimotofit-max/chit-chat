import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerUser } from "../services/auth/authService";
import { signupSchema } from "../features/auth/authValidation";
import { BRAND } from "../config/brand";

function getSignupErrorMessage(error) {
  if (error?.message === "USERNAME_ALREADY_TAKEN") {
    return "That username is already taken.";
  }

  if (error?.code === "auth/email-already-in-use") {
    return "An account with this email already exists.";
  }

  if (error?.code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }

  if (error?.code === "auth/weak-password") {
    return "Please choose a stronger password.";
  }

  if (error?.code === "auth/network-request-failed") {
    return "Network error. Please check your internet connection.";
  }

  return "Something went wrong. Please try again.";
}

function SignupPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      username: "",
      displayName: "",
    },
  });

  async function onSubmit(values) {
    setServerError("");

    try {
      await registerUser(values);
      navigate("/");
    } catch (error) {
      console.error(error);
      setServerError(getSignupErrorMessage(error));
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <div className="auth-grid" />

      <div className="auth-shell">
        <section className="auth-card signup-auth-card">
          <div className="auth-brand">
            <div className="auth-brand-mark" aria-hidden="true">
              <span>CC</span>
            </div>

            <div className="auth-brand-copy">
              <h1>{BRAND.name}</h1>
              <p>{BRAND.tagline || "A more personal way to connect"}</p>
            </div>
          </div>

          <form
            className="auth-form signup-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className="form-field">
              <label htmlFor="displayName">Display name</label>

              <input
                id="displayName"
                className={`auth-input ${errors.displayName ? "has-error" : ""}`}
                type="text"
                autoComplete="name"
                placeholder="Your name"
                {...register("displayName")}
              />

              {errors.displayName && (
                <span className="form-error">
                  {errors.displayName.message}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="username">Username</label>

              <input
                id="username"
                className={`auth-input ${errors.username ? "has-error" : ""}`}
                type="text"
                autoComplete="username"
                placeholder="Choose a username"
                {...register("username")}
              />

              {errors.username && (
                <span className="form-error">
                  {errors.username.message}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="email">Email</label>

              <input
                id="email"
                className={`auth-input ${errors.email ? "has-error" : ""}`}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
              />

              {errors.email && (
                <span className="form-error">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>

              <div className="auth-password-wrap">
                <input
                  id="password"
                  className={`auth-input ${
                    errors.password ? "has-error" : ""
                  }`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a secure password"
                  {...register("password")}
                />

                <button
                  className="auth-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.8} />
                  ) : (
                    <Eye size={18} strokeWidth={1.8} />
                  )}
                </button>
              </div>

              {errors.password && (
                <span className="form-error">
                  {errors.password.message}
                </span>
              )}
            </div>

            {serverError && (
              <div className="form-server-error" role="alert">
                {serverError}
              </div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={isSubmitting}
            >
              <span>
                {isSubmitting ? "Creating account..." : "Create account"}
              </span>

              {!isSubmitting && (
                <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          </form>
        </section>

        <section className="auth-signup-card">
          <span>Already have an account?</span>

          <button type="button" onClick={() => navigate("/login")}>
            Log in
            <ArrowRight size={14} strokeWidth={2.2} />
          </button>
        </section>

        <p className="auth-footer">{BRAND.name}</p>
      </div>
    </main>
  );
}

export default SignupPage;
