import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import cipherLogo from '@/assets/cipher-icon.png';
import { z } from 'zod';

const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  teamNumber: z.string().min(1, 'Team number is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 99999,
    'Enter a valid FTC team number (1-99999)'
  ),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function Auth() {
  const { user, loading, signUp, signIn } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamNumber, setTeamNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/event-select" replace />;
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const emailValidation = z.string().email('Invalid email address').safeParse(email);
    if (!emailValidation.success) {
      setError(emailValidation.error.errors[0].message);
      setSubmitting(false);
      return;
    }

    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      setError(error.message);
    } else {
      setResetEmailSent(true);
    }

    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    try {
      if (isSignUp) {
        const validation = signUpSchema.safeParse({ name, email, password, teamNumber });
        if (!validation.success) {
          setError(validation.error.errors[0].message);
          setSubmitting(false);
          return;
        }

        const { error } = await signUp(email, password, name, Number(teamNumber));
        if (error) {
          if (error.message.includes('already registered')) {
            setError('This email is already registered. Please sign in.');
          } else {
            setError(error.message);
          }
        } else {
          setSuccessMessage('Account created! Please check your email to verify your account.');
        }
      } else {
        const validation = signInSchema.safeParse({ email, password });
        if (!validation.success) {
          setError(validation.error.errors[0].message);
          setSubmitting(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password.');
          } else {
            setError(error.message);
          }
        }
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-1 bg-card items-center justify-center p-12">
        <div className="max-w-md text-center">
          <img src={cipherLogo} alt="Cipher" className="w-20 h-20 rounded-2xl mx-auto mb-8" />
          <h1 className="text-4xl font-bold mb-4 text-glow">12841×2844: Cipher</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Competition-Grade Scouting
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="data-card">
              <p className="stat-value text-primary">500+</p>
              <p className="stat-label">Matches</p>
            </div>
            <div className="data-card">
              <p className="stat-value text-secondary">Live</p>
              <p className="stat-label">Sync</p>
            </div>
            <div className="data-card">
              <p className="stat-value text-accent">Fast</p>
              <p className="stat-label">Input</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src={cipherLogo} alt="Cipher" className="w-12 h-12 rounded-xl" />
            <div>
              <h1 className="font-bold text-xl">Cipher</h1>
              <p className="text-xs text-muted-foreground">12841×2844</p>
            </div>
          </div>

          <div className="data-card">
            <h2 className="text-2xl font-bold mb-2">
              {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isForgotPassword
                ? "Enter your email and we'll send you a reset link"
                : isSignUp
                ? 'Sign up to start scouting matches'
                : 'Sign in to continue scouting'}
            </p>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
                <p className="text-sm text-primary">{successMessage}</p>
              </div>
            )}

            {isForgotPassword ? (
              resetEmailSent ? (
                <div>
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
                    <p className="text-sm text-primary">
                      If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly. Check your inbox (and spam folder).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setResetEmailSent(false);
                      setError('');
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-12 bg-input"
                      required
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-lg font-semibold"
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                    Send Reset Link
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setError('');
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-3 h-3 inline mr-1" />
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignUp && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className="h-12 bg-input"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teamNumber">FTC Team Number</Label>
                        <Input
                          id="teamNumber"
                          type="number"
                          value={teamNumber}
                          onChange={(e) => setTeamNumber(e.target.value)}
                          placeholder="12345"
                          className="h-12 bg-input"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-12 bg-input"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setError('');
                            setSuccessMessage('');
                          }}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 bg-input"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-lg font-semibold"
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError('');
                      setSuccessMessage('');
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isSignUp
                      ? 'Already have an account? Sign in'
                      : "Don't have an account? Sign up"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
