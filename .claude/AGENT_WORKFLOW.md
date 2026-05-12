# DataScriba — Agent Workflow

> Bu doküman 4 ajanın nasıl çalıştığını, birbirleriyle nasıl iletişim kurduğunu ve insan (siz) ile etkileşimi açıklar.

---

## 🎭 Ajanlar

| Ajan | Rol | Model | Renk | Modify? |
|------|-----|-------|------|---------|
| 🧠 **planner** | Analiz + görev bölme + plan | opus | 🟣 mor | Sadece plan dosyaları yazar |
| 🔨 **builder** | TypeScript kod yazımı | sonnet | 🔵 mavi | Üretim kodu + test yazar |
| 🔍 **reviewer** | Kalite + güvenlik denetimi | opus | 🟠 turuncu | Read-only, REVIEW.md üretir |
| 🧪 **tester** | Test yazımı + çalıştırma | sonnet | 🟢 yeşil | Sadece test kodu, çalıştırır |

**Neden bu model dağılımı?**
- **Planner ve Reviewer = Opus:** Karmaşık akıl yürütme ve eleştirel düşünce gerektirir
- **Builder ve Tester = Sonnet:** Hızlı, doğru üretim işleri için ideal
- Maliyet: Opus daha pahalı, ama plan ve review tipik olarak daha kısa konuşmalar

---

## 🔄 Akış Diyagramı

```
┌────────────────────────────────────────────────────────────────┐
│                       👤 KULLANICI                              │
│              "Faz 2'deki PostgreSQL driver'ı yapalım"            │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  🧠 PLANNER (opus)   │
                │  • CLAUDE.md oku     │
                │  • ROADMAP.md oku    │
                │  • Mevcut kodu tara  │
                │  • Plan üret         │
                └──────────┬───────────┘
                           │
                           ▼
                   📄 TASK_PLAN.md
                           │
                           ▼
                ┌──────────────────────┐
                │  👤 KULLANICI ONAYI   │ ← Manual gate
                │  (planı incele)      │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  🔨 BUILDER (sonnet) │
                │  • Plana göre kodla  │
                │  • Type-check + lint │
                │  • Basit testler ekle│
                │  • Progress güncelle │
                └──────────┬───────────┘
                           │
                           ▼
              📝 Kod + 📋 PROGRESS güncel
                           │
                           ▼
                ┌──────────────────────┐
                │ 🔍 REVIEWER (opus)   │
                │ • git diff oku       │
                │ • Güvenlik tara      │
                │ • CLAUDE.md uyum     │
                │ • REVIEW.md üret     │
                └──────────┬───────────┘
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
              ❌ REJECT          ✅ APPROVE
                  │                 │
                  ▼                 ▼
          [builder'a geri]   ┌──────────────────────┐
                             │ 🧪 TESTER (sonnet)   │
                             │ • Coverage tara      │
                             │ • Edge case test ekle│
                             │ • Tüm suite çalıştır │
                             │ • TEST_REPORT üret   │
                             └──────────┬───────────┘
                                        │
                               ┌────────┴────────┐
                               ▼                 ▼
                           ❌ FAIL           ✅ PASS
                               │                 │
                               ▼                 ▼
                       [builder'a geri]    ✨ DONE
                                                 │
                                                 ▼
                                          👤 commit/merge
```

---

## 📜 Handoff Protokolü

Ajanlar **dosyalar üzerinden** konuşur. Doğrudan birbirini çağırmaz — siz çağırırsınız.

### Dosya Akışı

```
TASK_PLAN.md          ← planner üretir, builder okur
PHASE_X_PROGRESS.md   ← builder günceller, reviewer ve tester okur
REVIEW.md             ← reviewer üretir, builder (red ise) okur
TEST_REPORT.md        ← tester üretir, kullanıcı okur
.claude/agents/<x>/MEMORY.md  ← her ajan kendi belleğini tutar
```

### Handoff Mesaj Şablonları

Her ajan **stopping** ederken aşağıdaki formatta net bir mesaj basar.

#### Planner → Builder

```
✅ Plan ready: postgres-driver
📄 File: TASK_PLAN.md
📊 Effort: M (~4 saat)
⚠️  Key risks:
   - Connection pool leak in error paths
   - SSL config edge cases
👉 Next: Invoke the builder agent with this plan.
   Command: "Use the builder agent to implement TASK_PLAN.md"
```

#### Builder → Reviewer

```
🔨 Builder complete
📋 Plan: TASK_PLAN.md (postgres-driver)
📁 Files changed:
   - packages/db-drivers/src/postgres.ts (new, 142 LOC)
   - packages/db-drivers/src/postgres.spec.ts (new, 78 LOC)
   - packages/db-drivers/src/index.ts (modified)
✅ Type-check: pass
✅ Lint: pass
✅ Tests: 8 passed, 0 failed
👉 Next: Invoke the reviewer agent.
   Command: "Use the reviewer agent to review recent changes"
```

#### Reviewer → Tester (or Builder if rejected)

```
🔍 Review complete: postgres-driver
📄 File: REVIEW.md
⚖️  Verdict: ✅ APPROVED WITH NOTES

Critical issues: 0
Warnings: 2 (non-blocking, see REVIEW.md)
Suggestions: 4

👉 Next: Invoke the tester agent.
   Command: "Use the tester agent to verify test coverage"
```

OR

```
🔍 Review complete: postgres-driver
📄 File: REVIEW.md
⚖️  Verdict: ❌ CHANGES REQUESTED

Critical issues: 1
   - Connection string logged in error path (postgres.ts:88)

👉 Next: Invoke the builder agent with REVIEW.md.
   Command: "Use the builder agent to address REVIEW.md issues"
```

#### Tester → Done (or Builder if failed)

```
🧪 Test complete: postgres-driver
📄 File: TEST_REPORT.md
⚖️  Verdict: ✅ PASS

Tests: 12 passed, 0 failed
Coverage: 94% lines, 100% functions
New tests added: 4 (edge cases)

👉 Ready for merge.
   Suggested commit: "feat(db-drivers): add PostgreSQL driver"
```

---

## 🚦 Manuel Gate'ler (Insan Onayı)

4 yerde insan onayı vardır:

1. **Plan onayı** — Planner çıktısını inceleyin, yanlışsa düzeltin
2. **Builder checkpoint** — Builder büyük işlerde ara verir, kontrol edin
3. **Review verdict** — Reject ise builder'a göndereceğiniz mesajı siz yazarsınız
4. **Final commit** — Test PASS sonrası commit kararı sizin

Bu gate'ler **yavaşlatmak değil, kontrolde kalmak içindir.** Acil durumlarda atlayabilirsiniz ama önermem.

---

## 🎯 Tipik Senaryolar

### Senaryo 1: Yeni Modül (PostgreSQL Driver)

```
👤: "Use the planner agent to plan the PostgreSQL driver for Phase 2."
🧠 planner: [okur → analiz → TASK_PLAN.md üretir]
👤: [planı inceler, OK] "Use the builder agent to execute TASK_PLAN.md"
🔨 builder: [kod yazar, test ekler] → stops at checkpoint
👤: "proceed"
🔨 builder: [tamamlar] → handoff to reviewer
👤: "Use the reviewer agent"
🔍 reviewer: REVIEW.md → ✅ APPROVED WITH NOTES
👤: "Use the tester agent"
🧪 tester: TEST_REPORT.md → ✅ PASS
👤: [commit + merge]
```

### Senaryo 2: Reviewer Reddetti

```
🔍 reviewer: REVIEW.md → ❌ CHANGES REQUESTED (security issue)
👤: "Use the builder agent to address REVIEW.md"
🔨 builder: [düzeltir] → handoff
👤: "Use the reviewer agent again"
🔍 reviewer: REVIEW.md → ✅ APPROVED
👤: "Use the tester agent"
🧪 tester: ✅ PASS
```

### Senaryo 3: Acil Hotfix (Tam akış gereksiz)

```
👤: "Use the builder agent to fix the typo in postgres.ts:42"
🔨 builder: [fix] → handoff
👤: "Use the reviewer agent"  ← Plan'ı atladık ama review kalmalı
🔍 reviewer: ✅ APPROVED
👤: [tester'ı da atla, commit]
```

Küçük değişikliklerde planner ve tester atlanabilir; **reviewer asla atlanmamalı.**

---

## 🛠️ Komut Reference Card

Ajanları çağırırken kullanabileceğiniz doğal dil + @-mention:

```
# Natural language (Claude karar verir)
"Use the planner agent to ..."
"Have the reviewer look at my recent changes"
"Run the tests with the tester agent"

# @-mention (garantili o ajan çalışır)
@planner plan the AI SQL generator module
@builder implement TASK_PLAN.md
@reviewer review the latest commit
@tester verify coverage on db-drivers package

# Session-wide (tüm session o ajanın system prompt'uyla)
claude --agent planner
```

---

## 📚 Memory Files

Her ajanın kendi `MEMORY.md` dosyası `.claude/agent-memory/<agent-name>/` altında oluşur (otomatik). İçerikler:

- **planner/MEMORY.md** — Mimari kararlar, NextReports analiz notları, decomposition pattern'leri
- **builder/MEMORY.md** — Kod pattern'leri, library quirk'leri, recurring boilerplate
- **reviewer/MEMORY.md** — Recurring issue'lar, false positive'ler, project-specific anti-pattern'ler
- **tester/MEMORY.md** — Flaky test alanları, test setup pattern'leri, performance baseline'lar

Bunlar **version control'a girer** (`memory: project` kullanıyoruz), takım çalışmasında paylaşılır.

---

## ⚙️ Konfigürasyon

`.claude/agents/` dosyaları YAML frontmatter + Markdown system prompt formatında.

**Değiştirmek isterseniz:**
```bash
# Belirli bir ajanı düzenle
claude /agents

# Veya dosyayı direkt aç
code .claude/agents/builder.md
```

**Yeni ajan eklemek isterseniz** (örn: `docwriter`):
```bash
claude /agents
# → Create new agent → Project scope → Generate with Claude
```

---

## 🚨 Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| Ajan TASK_PLAN.md olmadan başlamaya çalışıyor | Builder'ı doğrudan değil, sadece plan sonrası çağırın |
| Reviewer her şeyi reddediyor | CLAUDE.md çok katı olabilir, kuralları gözden geçirin |
| Tester her zaman %100 coverage istiyor | TEST_REPORT'ta justification'a izin verin |
| Planner gereksiz uzun planlar üretiyor | Effort `S` ise "atomic 3-5 step" sınırı koyun |
| Ajanlar birbirini çağırıyor | Subagent → subagent çağrısı yapılamaz. Siz orchestrate edersiniz. |

---

## 🎓 İyi Kullanım Pratikleri

1. **Planı her zaman gözden geçirin** — Otomatik onaylamayın, plan kalitesi sonuç kalitesidir
2. **Builder'ı çok büyük plan'larla yormayın** — XL plan = 4 ayrı M plan'a böl
3. **Reviewer feedback'ini ciddiye alın** — Suggestion'ları MEMORY.md'ye not edin
4. **Tester'ı kullanmaktan kaçınmayın** — En çok atlanan ama en kritik adım
5. **Memory'leri periyodik temizleyin** — 3-6 ayda bir gözden geçirin

---

**🎯 Sonuç:** 4 ajan, 4 dosya, 4 manuel gate. Karmaşık görünür ama her parça kendi işini yapar. Kuru kalabalık değil, disiplinli pipeline.
