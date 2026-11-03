import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_URL = (import.meta.env.VITE_API_URL).replace(/\/$/, '');

// Phones and in-app browsers lose the Google popup (blank white page), so they use full-page redirect instead.
const shouldUseRedirect = () =>
  /Android|iPhone|iPad|iPod|Mobile|FBAN|FBAV|Instagram|Line|WhatsApp|Snapchat|; wv\)/i.test(navigator.userAgent);

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
      googleScriptPromise = null; // allow a retry
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return googleScriptPromise;
};

const GoogleAuthButton = () => {
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    let cancelled = false;

    if (!GOOGLE_CLIENT_ID) {
      console.warn('VITE_GOOGLE_CLIENT_ID is not set — Google Sign-In is disabled.');
      return;
    }

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google) return;

        const redirect = shouldUseRedirect();
        const options = { client_id: GOOGLE_CLIENT_ID };

        if (redirect) {
          // Google posts the login to our server, which sets the cookie and sends the browser to /dashboard
          options.ux_mode = 'redirect';
          options.login_uri = `${API_URL}/auth/google/redirect`;
        } else {
          options.ux_mode = 'popup';
          options.callback = async (response) => {
            try {
              const result = await api.post('/auth/google', { credential: response.credential });
              const authenticatedUser = result.data.user;
              if (!authenticatedUser) {
                throw new Error('Google sign-in succeeded but no user data was returned.');
              }
              setUser(authenticatedUser);
              navigate(authenticatedUser.isProfileComplete ? '/dashboard' : '/onboarding');
            } catch (error) {
              alert(error.response?.data?.message || error.message || 'Google sign-in failed');
            }
          };
        }

        window.google.accounts.id.initialize(options);

        if (buttonRef.current) {
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'filled_black',
            size: 'large',
            width: 320,
            text: 'continue_with',
          });
        }
      })
      .catch((error) => console.error(error));

    return () => { cancelled = true; };
  }, [navigate, setUser]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="google-auth-wrap">
      <div ref={buttonRef} style={{ display: 'flex' }}></div>
    </div>
  );
};

export default GoogleAuthButton;