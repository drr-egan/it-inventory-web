// Firebase Authentication Component
// BENEFICIAL IMPROVEMENT: Role-based access control

const AuthComponent = () => {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [isSignUp, setIsSignUp] = React.useState(false);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSignUp) {
                // Create new user account
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);

                // Add user profile to Firestore
                await db.collection('userProfiles').doc(userCredential.user.uid).set({
                    email: email,
                    role: 'user', // Default role
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    active: true
                });

                console.log('✅ User account created');
            } else {
                // Sign in existing user
                await auth.signInWithEmailAndPassword(email, password);
                console.log('✅ User signed in');
            }
        } catch (error) {
            console.error('❌ Authentication error:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await auth.signOut();
            console.log('✅ User signed out');
        } catch (error) {
            console.error('❌ Sign out error:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full space-y-8">
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                            {isSignUp ? 'Create Account' : 'Sign In'}
                        </h2>
                        <p className="mt-2 text-center text-sm text-gray-600">
                            IT Inventory Management System
                        </p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleAuth}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                            </button>
                        </div>

                        <div className="text-center">
                            <button
                                type="button"
                                className="text-blue-600 hover:text-blue-500 text-sm"
                                onClick={() => setIsSignUp(!isSignUp)}
                            >
                                {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // User is authenticated - show user info bar
    return (
        <div className="bg-blue-600 text-white px-4 py-2 flex justify-between items-center">
            <div className="flex items-center space-x-4">
                <span className="text-sm">
                    👤 {user.email}
                </span>
                <span className="text-xs bg-blue-500 px-2 py-1 rounded">
                    Online
                </span>
            </div>
            <button
                onClick={handleSignOut}
                className="text-sm bg-blue-500 hover:bg-blue-400 px-3 py-1 rounded transition-colors"
            >
                Sign Out
            </button>
        </div>
    );
};

window.AuthComponent = AuthComponent;