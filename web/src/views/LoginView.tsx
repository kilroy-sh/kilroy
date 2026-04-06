import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KilroyMark } from '../components/KilroyMark';

export function LoginView() {
  const { user, account, loading, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && account) navigate('/projects');
    else if (user && !account) navigate('/onboarding');
  }, [user, account, loading]);

  if (loading) return null;

  return (
    <div className="app">
      <div className="landing">
        <div className="landing-header">
          <KilroyMark size={36} />
          <h1 className="landing-title">Sign in to Kilroy</h1>
        </div>
        <div className="login-buttons">
          <button className="btn btn-primary login-btn" onClick={() => signIn('github')}>
            Sign in with GitHub
          </button>
          <button className="btn login-btn" onClick={() => signIn('google')}>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
