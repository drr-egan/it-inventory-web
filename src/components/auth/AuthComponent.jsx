import React, { useState } from 'react';
import { signInWithRedirect, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../services/firebase';
import LoadingSpinner from '../shared/LoadingSpinner';

const AuthComponent = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');

        try {
            // Try popup first, fallback to redirect on mobile
            if (window.innerWidth <= 768) {
                await signInWithRedirect(auth, googleProvider);
            } else {
                await signInWithPopup(auth, googleProvider);
            }
        } catch (error) {
            console.error('Sign-in error:', error);
            if (error.code === 'auth/unauthorized-domain') {
                setError('Domain not authorized. Please add localhost:8080 to Firebase authorized domains, or test the deployed version.');
            } else {
                setError(error.message || 'Failed to sign in. Please try again.');
            }
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full border border-gray-700">
                {/* Header */}
                <div className="text-center mb-8">
                    <div style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: '#1976d2',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        boxShadow: '0 4px 6px rgba(25, 118, 210, 0.3)'
                    }}>
                        <span className="material-icons text-white text-2xl">inventory_2</span>
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">
                        IT Inventory Management
                    </h2>
                    <p className="text-gray-400">
                        Sign in to access your inventory dashboard
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-md">
                        <div className="flex">
                            <span className="material-icons text-red-400 mr-2">error</span>
                            <div>
                                <p className="text-red-300 text-sm">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sign In Button */}
                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full bg-white border border-gray-600 rounded-md py-3 px-4 flex items-center justify-center space-x-3 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    {loading ? (
                        <LoadingSpinner />
                    ) : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span className="font-medium">Sign in with Google</span>
                        </>
                    )}
                </button>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">
                        Secure authentication powered by Firebase
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthComponent;