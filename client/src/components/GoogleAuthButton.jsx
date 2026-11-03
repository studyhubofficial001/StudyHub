import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import { setAuthToken } from '../api/authTokenStorage';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let googleScriptPromise = null;
const loadGoogleScript = () => {
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => {
      googleScriptPromise = null;
      reject(new Error('Unable to load Google Sign-In. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return googleScriptPromise;
};

const GoogleAuthButton = () => {
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!GOOGLE_CLIENT_ID) {
      console.warn('VITE_GOOGLE_CLIENT_ID is not set — Google Sign-In is disabled.');
      return;
    }

    loadGoogleScript().then(() => {
      if (cancelled || !window.google) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        callback: async (response) => {
          try {
            if (!response.credential) {
              throw new Error('Google did not return a sign-in credential. Please try again.');
            }

            const result = await api.post('/auth/google', { credential: response.credential });
            if (result.data.token) {
              setAuthToken(result.data.token);
            }
            const authenticatedUser = result.data.user;
            if (!authenticatedUser) {
              throw new Error('Google sign-in succeeded but no user data was returned.');
            }

            setUser(authenticatedUser);
            navigate(authenticatedUser.isProfileComplete ? '/dashboard' : '/onboarding');
          } catch (error) {
            console.error('Google sign-in failed:', error);
            setErrorMessage(error.response?.data?.message || error.message || 'Google sign-in failed. Please try again.');
          }
        }
      });

      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'filled_black',
          size: 'large',
          width: 320,
          text: 'continue_with'
        });
      }
    }).catch((error) => {
      if (!cancelled) {
        console.error('Unable to initialize Google Sign-In:', error);
        setErrorMessage(error.message || 'Unable to load Google Sign-In.');
      }
    });

    return () => { cancelled = true; };
  }, [navigate, setUser]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="google-auth-wrap">
      <div ref={buttonRef} style={{ display: 'flex' }}></div>
      {errorMessage && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
};

export default GoogleAuthButton;