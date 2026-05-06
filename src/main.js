/**
 * 先检查 Vite 环境变量，再动态加载应用。
 * 避免在 Vercel 未配置 VITE_SUPABASE_* 时，import router → supabase 在模块顶层抛错导致整页白屏。
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!url || !key) {
  const el = document.getElementById('app')
  if (el) {
    el.innerHTML = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:34rem;margin:3rem auto;padding:0 1.25rem;line-height:1.65;color:#0f172a;">
        <h1 style="font-size:1.2rem;margin:0 0 0.75rem;">前端未拿到 Supabase 环境变量</h1>
        <p style="margin:0 0 1rem;color:#475569;">Vite 只在<strong>构建时</strong>把以 <code style="background:#f1f5f9;padding:.1em .35em;border-radius:4px;">VITE_</code> 开头的变量打进包。若在 Vercel 里刚添加变量，必须<strong>重新部署</strong>一次才会生效。</p>
        <p style="margin:0 0 0.75rem;">请在 Vercel 项目中添加（Production 与 Preview 建议都配）：</p>
        <ul style="margin:0 0 1rem;padding-left:1.2rem;color:#334155;">
          <li><code>VITE_SUPABASE_URL</code> — 形如 <code>https://xxx.supabase.co</code>（不要带 <code>/rest/v1/</code>）</li>
          <li><code>VITE_SUPABASE_ANON_KEY</code> — Supabase 控制台 → Project Settings → API → <strong>anon public</strong> 密钥</li>
        </ul>
        <p style="margin:0;font-size:0.9rem;color:#64748b;">路径：Vercel → 你的项目 → Settings → Environment Variables → 保存后 → Deployments → 右上角 … → Redeploy。</p>
      </div>`
  }
} else {
  import('./bootstrap.js')
}
