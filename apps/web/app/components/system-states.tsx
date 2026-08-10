"use client";

import Image from "next/image";
import type { FormEvent } from "react";

export function LoadingScreen() {
  return (
    <div
      style={{
        background: "#EFEDE6",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
      }}
    >
      Loading System...
    </div>
  );
}

interface LoginScreenProps {
  loginUserId: string;
  loginPin: string;
  toast: { show: boolean; message: string };
  onUserChange: (userId: string) => void;
  onPinChange: (pin: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function LoginScreen({
  loginUserId,
  loginPin,
  toast,
  onUserChange,
  onPinChange,
  onSubmit,
}: LoginScreenProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--paper)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        overflowY: "auto",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
          padding: "32px 24px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          borderRadius: "18px",
          background: "var(--paper-raised)",
        }}
      >
        <Image
          src="/Prince Iyke logo.png"
          alt="Logo"
          width={120}
          height={120}
          style={{
            width: "120px",
            height: "120px",
            margin: "0 auto 16px",
            display: "block",
            borderRadius: "14px",
            objectFit: "contain",
          }}
        />
        <div
          className="modal-title"
          style={{ fontSize: "22px", marginBottom: "8px" }}
        >
          Prince Iyke Merchants
        </div>
        <div
          style={{
            fontSize: "13.5px",
            color: "var(--ink-soft)",
            marginBottom: "24px",
          }}
        >
          Sign in with your individual account. Your last authenticated session remains available offline.
        </div>

        <form onSubmit={onSubmit}>
          <div
            className="field"
            style={{ textAlign: "left", marginBottom: "16px" }}
          >
            <label>Email address</label>
            <input
              type="email"
              value={loginUserId}
              onChange={(event) => onUserChange(event.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              style={{
                padding: "12px",
                fontSize: "15px",
                borderRadius: "10px",
              }}
            />
          </div>

          <div
            className="field"
            style={{ textAlign: "left", marginBottom: "24px" }}
          >
            <label>Password</label>
            <input
              type="password"
              placeholder="Password"
              value={loginPin}
              onChange={(event) => onPinChange(event.target.value)}
              autoComplete="current-password"
              style={{
                textAlign: "center",
                fontSize: "16px",
                padding: "12px",
                fontFamily: "var(--font-mono)",
                borderRadius: "10px",
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: "14px", fontSize: "16px" }}
          >
            Access System
          </button>
        </form>
      </div>

      {toast.show && <div className="toast show">{toast.message}</div>}
    </div>
  );
}
