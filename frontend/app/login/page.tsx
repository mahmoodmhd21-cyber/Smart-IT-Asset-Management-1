"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Head from "next/head";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import styles from "./login.module.css";

// 1. Define the exact shape and rules of your data
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState("");

  // 2. Wire up the form hook with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setApiError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed. Please try again.");
      }

      // 3. Token stored locally as requested
      localStorage.setItem("authToken", result.token);
      localStorage.setItem("currentUser", JSON.stringify(result.user));
      
      router.push("/dashboard");
    } catch (error: any) {
      setApiError(error.message);
    }
  };

  return (
    <>
      <Head>
        <title>Login | Smart IT Asset Management</title>
      </Head>
      <main className={styles.loginPage}>
        <section className={`card ${styles.loginCard}`} aria-labelledby="login-title">
          <div className={styles.companyLogo} aria-label="Smart IT Asset Management">
            <span className={styles.logoMark}>SI</span>
            <span className={styles.logoText}>Smart IT Asset Management</span>
          </div>

          <div className={styles.loginHeader}>
            <h1 id="login-title">Login</h1>
            <p>Access your asset management dashboard.</p>
          </div>

          <form id="loginForm" noValidate onSubmit={handleSubmit(onSubmit)}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                autoComplete="email"
                placeholder="name@company.com"
                aria-describedby="emailError"
                {...register("email")}
              />
              {errors.email && (
                <p className={styles.errorMessage} id="emailError">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-describedby="passwordError"
                {...register("password")}
              />
              {errors.password && (
                <p className={styles.errorMessage} id="passwordError">
                  {errors.password.message}
                </p>
              )}
            </div>

            <label className={styles.showPassword}>
              <input
                type="checkbox"
                id="showPassword"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <span>Show password</span>
            </label>

            {apiError && (
              <p className={`${styles.errorMessage} ${styles.formError}`} role="alert">
                {apiError}
              </p>
            )}

            <button
              type="submit"
              className={`button ${styles.loginButton}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging in..." : "Login"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}