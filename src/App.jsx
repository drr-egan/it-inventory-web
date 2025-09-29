import React, { Suspense, useState, useEffect } from 'react';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from './components/shared/LoadingSpinner';
import ErrorBoundary from './components/shared/ErrorBoundary';

// Lazy load main components for code splitting
const AuthComponent = React.lazy(() => import('./components/auth/AuthComponent'));
const MainApp = React.lazy(() => import('./components/MainApp'));

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('Auth state changed:', user ? user.email : 'No user');
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="large" />
                <span className="ml-4 text-gray-600">Loading application...</span>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="App min-h-screen bg-gray-50">
                <Suspense
                    fallback={
                        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                            <LoadingSpinner size="large" />
                            <span className="ml-4 text-gray-600">
                                {user ? 'Loading dashboard...' : 'Loading authentication...'}
                            </span>
                        </div>
                    }
                >
                    {user ? <MainApp user={user} /> : <AuthComponent />}
                </Suspense>
            </div>
        </ErrorBoundary>
    );
}

export default App;