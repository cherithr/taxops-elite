import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";

// ─── DESIGN TOKENS (mirrored from App.jsx) ───────────────────────────────────
const T = {
  bg0:"#080A0F", bg1:"#0D1117", bg2:"#161B26", bg3:"#1E2638", bg4:"#252D3D",
  border:"rgba(99,120,170,0.15)", borderHover:"rgba(99,120,170,0.35)",
  blue:"#3B82F6", blueDim:"#1D4ED8", blueGlow:"rgba(59,130,246,0.18)",
  emerald:"#10B981", crimson:"#EF4444", violet:"#8B5CF6",
  violetGlow:"rgba(139,92,246,0.15)", amber:"#F59E0B",
  text0:"#F8FAFC", text1:"#CBD5E1", text2:"#94A3B8", text3:"#64748B",
  glass:"rgba(255,255,255,0.03)", glassBorder:"rgba(255,255,255,0.07)",
};

// ─── MODES ───────────────────────────────────────────────────────────────────
const MODE = { SIGN_IN:"signin", SIGN_UP:"signup", RESET:"reset" };

// ─── FIELD ───────────────────────────────────────────────────────────────────
const Field = ({ label, type="text", value, onChange, placeholder, autoComplete }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <label style={{ fontSize:11, fontWeight:700, color:T.text3,
        letterSpacing:"0.07em", textTransform:"uppercase" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onFocus={()=>setFocused(true)}
        onBlur={()=>setFocused(false)}
        style={{
          padding:"11px 14px", borderRadius:10, fontSize:14,
          background:T.bg3, color:T.text0, fontFamily:"inherit",
          border:`1px solid ${focused ? T.blue : T.border}`,
          outline:"none", width:"100%",
          boxShadow: focused ? `0 0 0 3px ${T.blueGlow}` : "none",
          transition:"border-color 0.2s, box-shadow 0.2s",
        }} />
    </div>
  );
};

// ─── ERROR BANNER ─────────────────────────────────────────────────────────────
const ErrorBanner = ({ msg }) =>
  msg ? (
    <div style={{ background:`${T.crimson}15`, border:`1px solid ${T.crimson}30`,
      borderRadius:8, padding:"10px 14px", fontSize:13, color:T.crimson,
      display:"flex", alignItems:"center", gap:8 }}>
      <span>⚠</span> {msg}
    </div>
  ) : null;

// ─── SUCCESS BANNER ───────────────────────────────────────────────────────────
const SuccessBanner = ({ msg }) =>
  msg ? (
    <div style={{ background:`${T.emerald}15`, border:`1px solid ${T.emerald}30`,
      borderRadius:8, padding:"10px 14px", fontSize:13, color:T.emerald,
      display:"flex", alignItems:"center", gap:8 }}>
      <span>✓</span> {msg}
    </div>
  ) : null;

// ─── FRIENDLY FIREBASE ERROR MESSAGES ────────────────────────────────────────
const friendlyError = (code) => {
  const map = {
    "auth/user-not-found":       "No account found with that email.",
    "auth/wrong-password":       "Incorrect password. Please try again.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/too-many-requests":    "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed":"Network error. Check your connection.",
    "auth/invalid-credential":   "Invalid email or password.",
  };
  return map[code] || "Something went wrong. Please try again.";
};

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const [mode,     setMode]     = useState(MODE.SIGN_IN);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const clearMessages = () => { setError(""); setSuccess(""); };

  const switchMode = (next) => {
    setMode(next);
    setPassword("");
    setConfirm("");
    clearMessages();
  };

  // ── Sign In ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up ────────────────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!email || !password || !confirm) { setError("Please fill in all fields."); return; }
    if (password !== confirm)            { setError("Passwords do not match.");     return; }
    if (password.length < 6)             { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Password Reset ─────────────────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess("Reset link sent! Check your inbox.");
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Submit router ──────────────────────────────────────────────────────────
  const handleSubmit = mode === MODE.SIGN_IN ? handleSignIn
                     : mode === MODE.SIGN_UP  ? handleSignUp
                     : handleReset;

  // ── Labels ────────────────────────────────────────────────────────────────
  const titles = {
    [MODE.SIGN_IN]: { heading:"Welcome back",        sub:"Sign in to TaxOps Elite",         btn:"Sign In"          },
    [MODE.SIGN_UP]: { heading:"Create your account", sub:"Get started with TaxOps Elite",   btn:"Create Account"   },
    [MODE.RESET]:   { heading:"Reset your password", sub:"We'll email you a reset link",     btn:"Send Reset Link"  },
  };
  const { heading, sub, btn } = titles[mode];

  return (
    <div style={{
      minHeight:"100vh", background:T.bg0, display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"-apple-system,'SF Pro Display','Inter',system-ui,sans-serif",
      padding:16, position:"relative", overflow:"hidden",
    }}>

      {/* ── Background glow ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background:`
          radial-gradient(ellipse 70% 50% at 20% 10%,  rgba(59,130,246,0.07) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 80% 90%,  rgba(139,92,246,0.06) 0%, transparent 60%)
        ` }} />

      <div style={{ width:"100%", maxWidth:420, position:"relative", zIndex:1 }}>

        {/* ── Logo ── */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:32 }}>
          <div style={{
            width:52, height:52, borderRadius:14,
            background:`linear-gradient(135deg,${T.blue},${T.violet})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:24, marginBottom:14,
            boxShadow:`0 8px 32px ${T.blueGlow}, 0 0 0 1px ${T.glassBorder}`,
          }}>⬡</div>
          <div style={{ fontSize:22, fontWeight:700, color:T.text0,
            letterSpacing:"-0.02em", marginBottom:4 }}>{heading}</div>
          <div style={{ fontSize:13, color:T.text3 }}>{sub}</div>
        </div>

        {/* ── Card ── */}
        <div style={{
          background:"rgba(22,27,38,0.72)", backdropFilter:"blur(20px)",
          border:`1px solid ${T.glassBorder}`, borderRadius:18,
          padding:"28px 28px 24px",
          boxShadow:"0 24px 64px rgba(0,0,0,0.5)",
        }}>
          <form onSubmit={handleSubmit}
            style={{ display:"flex", flexDirection:"column", gap:16 }}>

            <ErrorBanner   msg={error}   />
            <SuccessBanner msg={success} />

            <Field
              label="Email Address"
              type="email"
              value={email}
              onChange={e=>{ setEmail(e.target.value); clearMessages(); }}
              placeholder="you@firm.com"
              autoComplete="email" />

            {mode !== MODE.RESET && (
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={e=>{ setPassword(e.target.value); clearMessages(); }}
                placeholder={mode===MODE.SIGN_UP?"Min. 6 characters":"••••••••"}
                autoComplete={mode===MODE.SIGN_IN?"current-password":"new-password"} />
            )}

            {mode === MODE.SIGN_UP && (
              <Field
                label="Confirm Password"
                type="password"
                value={confirm}
                onChange={e=>{ setConfirm(e.target.value); clearMessages(); }}
                placeholder="Re-enter password"
                autoComplete="new-password" />
            )}

            {/* ── Forgot password link ── */}
            {mode === MODE.SIGN_IN && (
              <div style={{ textAlign:"right", marginTop:-8 }}>
                <button type="button"
                  onClick={()=>switchMode(MODE.RESET)}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    fontSize:12, color:T.blue, padding:0, fontFamily:"inherit" }}>
                  Forgot password?
                </button>
              </div>
            )}

            {/* ── Submit ── */}
            <button type="submit" disabled={loading}
              style={{
                marginTop:4, padding:"12px", borderRadius:10, border:"none",
                background:`linear-gradient(135deg,${T.blue},${T.blueDim})`,
                color:"#fff", fontSize:14, fontWeight:700, cursor:loading?"not-allowed":"pointer",
                fontFamily:"inherit", letterSpacing:"0.01em",
                opacity: loading ? 0.7 : 1,
                transition:"all 0.2s",
                boxShadow:`0 4px 16px ${T.blueGlow}`,
              }}>
              {loading ? "Please wait…" : btn}
            </button>
          </form>

          {/* ── Mode switcher ── */}
          <div style={{ marginTop:20, paddingTop:18,
            borderTop:`1px solid ${T.border}`, textAlign:"center" }}>
            {mode === MODE.SIGN_IN && (
              <span style={{ fontSize:13, color:T.text3 }}>
                Don't have an account?{" "}
                <button onClick={()=>switchMode(MODE.SIGN_UP)}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    fontSize:13, color:T.blue, fontWeight:600,
                    padding:0, fontFamily:"inherit" }}>
                  Create one
                </button>
              </span>
            )}
            {mode === MODE.SIGN_UP && (
              <span style={{ fontSize:13, color:T.text3 }}>
                Already have an account?{" "}
                <button onClick={()=>switchMode(MODE.SIGN_IN)}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    fontSize:13, color:T.blue, fontWeight:600,
                    padding:0, fontFamily:"inherit" }}>
                  Sign in
                </button>
              </span>
            )}
            {mode === MODE.RESET && (
              <button onClick={()=>switchMode(MODE.SIGN_IN)}
                style={{ background:"none", border:"none", cursor:"pointer",
                  fontSize:13, color:T.blue, fontFamily:"inherit", padding:0 }}>
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign:"center", marginTop:20,
          fontSize:11, color:T.text3, letterSpacing:"0.04em" }}>
          TAXOPS ELITE · INDIRECT TAX OS
        </div>
      </div>
    </div>
  );
}
