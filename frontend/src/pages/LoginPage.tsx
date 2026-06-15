import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
    const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate('/admin');
    } catch {
      toast.error(t('login.errorInvalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-transparent">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6 items-stretch sf-fade-in">
        <section className="hidden lg:flex sf-card p-8 flex-col justify-between bg-[linear-gradient(135deg,#0f766e_0%,#134e4a_55%,#0b2536_100%)] text-white">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-white/80">Retail Operations</p>
            <h1 className="text-4xl font-bold mt-3 leading-tight">Configurable Platform</h1>
            <p className="mt-4 text-white/85 max-w-md">
              Unified catalog, CRM, HR, warranties, and documents with fast in-store workflows.
            </p>
          </div>
          <div className="text-xs text-white/70">
            Production-ready demo environment
          </div>
        </section>

        <form onSubmit={handleSubmit} className="sf-card p-8 md:p-10 w-full max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900">{t('login.title')}</h2>
          <p className="text-sm text-slate-500 mt-2 mb-6">{t('login.signInDescription')}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('login.username')}</label>
              <input
                type="text"
                placeholder={t('login.usernamePlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('login.password')}</label>
              <input
                type="password"
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 bg-teal-700 text-white rounded-xl hover:bg-teal-800 disabled:opacity-50 font-semibold shadow-sm"
          >
            {loading ? t('buttons.loading') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
