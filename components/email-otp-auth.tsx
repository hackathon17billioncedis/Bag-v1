'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/client-config';
import type { SessionUser } from '@/lib/auth';

type Props = {
  onSuccess: (user: SessionUser) => Promise<void> | void;
  className?: string;
  fullWidth?: boolean;
};

export function EmailOTPAuth({ onSuccess, className, fullWidth = false }: Props) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOTP = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send OTP');
      }

      setStep('otp');
      setCountdown(60); // 60 seconds cooldown
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError('Please enter the OTP');
      return;
    }

    if (otp.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/auth/verify-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Invalid OTP');
      }

      if (result.user) {
        await onSuccess(result.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return; // Don't allow resending during cooldown

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resend OTP');
      }

      setCountdown(60); // Reset cooldown
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      {step === 'email' ? (
        <div className="email-input-section">
          <h3>Sign in with Email</h3>
          <p className="meta-row">Enter your email to receive a one-time password</p>
          
          <div className="input-group">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input-field"
              disabled={loading}
            />
            <button 
              className="button button-primary" 
              onClick={handleSendOTP} 
              disabled={loading || !email}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        </div>
      ) : (
        <div className="otp-input-section">
          <h3>Enter OTP</h3>
          <p className="meta-row">
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>
          
          <div className="input-group">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="input-field"
              maxLength={6}
              disabled={loading}
            />
            <button 
              className="button button-primary" 
              onClick={handleVerifyOTP} 
              disabled={loading || otp.length !== 6}
            >
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
          </div>
          
          <div className="otp-actions">
            <button 
              className="resend-button" 
              onClick={handleResendOTP} 
              disabled={loading || countdown > 0}
            >
              {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
            </button>
            
            <button 
              className="back-button" 
              onClick={() => {
                setStep('email');
                setError('');
              }}
              disabled={loading}
            >
              Back
            </button>
          </div>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}