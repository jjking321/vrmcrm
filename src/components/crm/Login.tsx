import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Home, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = (): string | null => {
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    
    if (!isLogin) {
      if (!name.trim()) return 'Name is required';
      if (!companyName.trim()) return 'Company name is required';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const { error: loginError } = await login(email, password);
        if (loginError) {
          setError(loginError);
        }
      } else {
        const { error: signupError } = await signup(name, email, companyName, password);
        if (signupError) {
          setError(signupError);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="flex items-center gap-3 text-brand mb-8">
        <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center shadow-brand">
          <Home className="w-7 h-7 text-brand-foreground" />
        </div>
        <span className="text-3xl font-bold tracking-tight text-foreground">AddressFirst</span>
      </div>

      <div className="bg-card rounded-2xl shadow-medium border border-border w-full max-w-md overflow-hidden animate-slide-up">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {isLogin ? 'Sign in to manage your properties' : 'Start managing properties smarter'}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full p-3 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-all"
                    placeholder="Coastal Property Management"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-all"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 pr-10 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-brand text-brand-foreground py-3 rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-muted/50 p-4 text-center border-t border-border">
          <button
            onClick={handleToggleMode}
            className="text-sm font-medium text-muted-foreground hover:text-brand transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};
