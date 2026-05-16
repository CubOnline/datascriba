'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { setToken } from '@/lib/auth'
import { env } from '@/lib/env'

function DataScribaLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="10" r="3" fill="#6366F1" />
      <circle cx="22" cy="18" r="3" fill="#6366F1" />
      <circle cx="34" cy="18" r="3" fill="#6366F1" />
      <circle cx="16" cy="26" r="3" fill="#8B5CF6" />
      <circle cx="28" cy="26" r="3" fill="#8B5CF6" />
      <circle cx="40" cy="26" r="3" fill="#8B5CF6" />
      <circle cx="22" cy="34" r="3" fill="#0F172A" />
      <circle cx="34" cy="34" r="3" fill="#0F172A" />
      <rect x="26.5" y="38" width="3" height="10" rx="1.5" fill="#0F172A" />
    </svg>
  )
}

export function LoginClient() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.message ?? 'Giriş başarısız')
        return
      }
      const data = await res.json()
      setToken(data.accessToken)
      router.push('/')
    } catch {
      setError('Sunucuya bağlanılamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[520px]">

          {/* LEFT — Form */}
          <div className="bg-[#FDFDF7] p-10 flex flex-col justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <DataScribaLogo />
              <span className="text-[17px] font-semibold tracking-tight text-[#0F172A]">DataScriba</span>
            </div>

            {/* Form */}
            <div>
              <h1 className="text-2xl font-medium text-[#0F172A] tracking-tight">Tekrar hoş geldiniz</h1>
              <p className="text-sm text-[#64748B] mt-1.5">Hesabınıza giriş yapın</p>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1.5">E-posta</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@datascriba.com"
                    required
                    className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-md text-sm bg-[#FDFDF7] text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#475569]">Şifre</label>
                    <span className="text-xs text-[#6366F1] cursor-pointer hover:underline">Unuttunuz mu?</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2.5 pr-10 border border-[#E2E8F0] rounded-md text-sm bg-[#FDFDF7] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-[#6366F1] hover:bg-indigo-700 text-[#FDFDF7] py-2.5 rounded-md text-sm font-medium transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Giriş yap
                </button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-xs text-[#94A3B8]">veya</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              <button
                type="button"
                className="w-full bg-[#FDFDF7] border border-[#E2E8F0] py-2.5 rounded-md text-xs text-[#334155] flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google ile devam et
              </button>
            </div>

            {/* Footer */}
            <p className="text-xs text-[#64748B]">
              Hesabınız yok mu?{' '}
              <span className="text-[#6366F1] font-medium cursor-pointer hover:underline">Kayıt olun</span>
            </p>
          </div>

          {/* RIGHT — Brand panel */}
          <div className="bg-[#0F172A] p-10 flex flex-col justify-between relative overflow-hidden">
            {/* Decorative dot grid */}
            <svg
              className="absolute top-5 right-5 opacity-15"
              width="120" height="100" viewBox="0 0 120 100"
              aria-hidden="true"
            >
              {[20, 40, 60, 80, 100].map((cx) =>
                [20, 40, 60, 80].map((cy) => (
                  <circle
                    key={`${cx}-${cy}`}
                    cx={cx} cy={cy} r="2"
                    fill={cy <= 40 ? '#A5B4FC' : cy === 60 ? '#A5B4FC' : '#C4B5FD'}
                    opacity={cy >= 60 ? cy === 60 ? 0.7 : 0.5 : 1}
                  />
                ))
              )}
            </svg>

            <div />

            <div>
              <h2 className="text-3xl font-medium text-[#FDFDF7] leading-tight tracking-tight">
                Reports, <br />written by <span className="text-[#A5B4FC]">Scriba</span>.
              </h2>
              <p className="text-sm text-[#94A3B8] mt-3 max-w-xs leading-relaxed">
                Doğal dilden SQL üretin, sürükle-bırak ile rapor tasarlayın, otomatik dağıtın.
              </p>
            </div>

            <div className="bg-white/[0.04] px-4 py-3.5 rounded-lg border-l-2 border-[#8B5CF6]">
              <p className="text-xs text-[#E2E8F0] leading-relaxed italic">
                "Saatler süren SQL yazımı 30 saniyeye indi. Scriba gerçek bir kâtip."
              </p>
              <p className="text-xs text-[#94A3B8] mt-2">Ada • Veri analisti</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
