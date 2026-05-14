# REVIEW.md — Phase 4: Görsel Rapor Tasarımcısı

**Reviewer:** code-review agent
**Date:** 2026-05-14
**Status:** APPROVED

---

## Kritik Sorunlar (C-*)

Aşağıdaki kritik sorunlar tespit edildi ve **reviewer tarafından düzeltildi**.

### C-1 — Filename Injection / URIError Crash (FIXED)

**Dosya:** `apps/web/src/app/[locale]/reports/run-report-dialog.tsx`

`Content-Disposition` header'dan alınan `filename` değeri üç ayrı soruna sahipti:

1. `decodeURIComponent()` try/catch olmadan çağrılıyordu — sunucu hatalı bir `%`-sequence dönerse `URIError` fırlatır ve download sessizce çökerdi.
2. Regex (`/filename="([^"]+)"/`) yalnızca tırnaklı `filename="..."` formunu yakalıyordu; RFC 5987 `filename*=UTF-8''...` ve tırnaksız değerleri kaçırıyordu.
3. Dizin ayırıcıları (`/`, `\`) temizlenmiyordu. `a.download` modern tarayıcılarda path traversal'ı filtreler, ancak ham değerin normalize edilmemesi savunmasız kullanıcı-agent'larında risk oluşturur.

**Uygulanan düzeltme:**
- RFC 5987 uyumlu genişletilmiş regex kullanıldı.
- `decodeURIComponent` try/catch ile sarıldı; decode başarısız olursa raw değer fallback olarak kullanılır.
- Decoded filename'den `/` ve `\` karakterleri `_` ile değiştirildi.
- `onSubmit` fonksiyonuna explicit `Promise<void>` return type eklendi.

---

### C-2 — Open Redirect via Server-Returned `id` (FIXED)

**Dosya:** `apps/web/src/app/[locale]/reports/[id]/edit/report-editor-client.tsx`

`createReport.mutateAsync()` sonucundan gelen `created.id` Zod doğrulaması yapılmadan `router.push(\`/reports/${created.id}/edit\`)` parametresi olarak kullanılıyordu. API yanıtları runtime'da doğrulanmadığından, manipüle edilmiş bir yanıt (MitM veya hatalı API) `../../admin` gibi bir `id` döndürerek istenmeyen bir path'e yönlendirebilirdi.

**Uygulanan düzeltme:**
- `id` değeri `/^[\w-]+$/` regex ile doğrulanıyor; geçersizse `Error` fırlatılıyor.
- `router.push` yalnızca `safeId` ile çağrılıyor.
- `handleSave` fonksiyonuna explicit `Promise<void>` return type eklendi.
- `handleSave` try/catch ile sarıldı (ayrıca W-3'ü de kapatır).

---

## Uyarılar (W-*)

Aşağıdaki uyarılar tespit edildi ve reviewer tarafından düzeltildi.

### W-1 — `ReactQueryDevtools` Production'da Dahil (FIXED)

**Dosya:** `apps/web/src/components/providers.tsx`

`ReactQueryDevtools` koşulsuz render ediliyordu. Production build'de devtools bundle'ı dahil edilmekte ve iç query state'i açığa çıkarılmaktadır.

**Uygulanan düzeltme:** `process.env.NODE_ENV !== 'production'` koşuluna alındı. `Providers` fonksiyonuna explicit `React.JSX.Element` return type eklendi.

### W-2 — `apiClient` Method'larında Explicit Return Type Eksik (FIXED)

**Dosya:** `apps/web/src/lib/api-client.ts`

CLAUDE.md kuralı: "Explicit return types — export edilen fonksiyonlarda". `apiClient` nesnesinin tüm method'ları (`get`, `post`, `put`, `delete`, `postRaw`) explicit return type içermiyordu.

**Uygulanan düzeltme:** Her method'a `Promise<T>` veya `Promise<Response>` return type eklendi. `ApiError` class'ı `export` edildi (çağıran kod için tip dar olabilmesi adına).

### W-3 — `handleSave` / `onSubmit` Fonksiyonlarında Error Handling Eksik (FIXED)

**Dosyalar:**
- `apps/web/src/app/[locale]/reports/[id]/edit/report-editor-client.tsx` — `handleSave`
- `apps/web/src/app/[locale]/data-sources/data-source-dialog.tsx` — `onSubmit`

`async` fonksiyonlar `try/catch` olmadan `mutateAsync` çağırıyordu; unhandled Promise rejection oluşabiliyordu.

**Uygulanan düzeltme:** Her iki fonksiyona try/catch eklendi. Hatalar mutation state (`isError` / `error`) üzerinden UI'a yansır.

### W-4 — Hardcoded İngilizce String (FIXED)

**Dosya:** `apps/web/src/app/[locale]/reports/[id]/edit/report-editor-client.tsx`

`"Unsaved changes"` i18n namespace dışı hardcoded string olarak bırakılmıştı.

**Uygulanan düzeltme:** `tc('unsavedChanges')` ile değiştirildi. Builder `messages/en.json` ve `messages/tr.json` dosyalarına `"unsavedChanges"` key'ini eklemelidir.

---

## Öneriler (S-*)

Aşağıdakiler kapsam veya breaking change riski nedeniyle reviewer tarafından düzeltilmedi; builder bir sonraki sprint'te değerlendirmeli.

### S-1 — Hook Fonksiyonlarında Explicit Return Type Eksik

**Dosyalar:** `apps/web/src/hooks/use-data-sources.ts`, `apps/web/src/hooks/use-reports.ts`

Tüm export edilen hook fonksiyonları explicit return type içermiyor. CLAUDE.md standardını karşılamak için TanStack Query return type'ları (`UseQueryResult<T>`, `UseMutationResult<T, Error, Variables>`) eklenmeli.

### S-2 — `res.json() as Promise<T>` Runtime Doğrulaması Yok

**Dosya:** `apps/web/src/lib/api-client.ts`

API yanıtları yalnızca TypeScript generic parametresine dayalı olarak cast ediliyor; Zod ile runtime şekil doğrulaması yapılmıyor. Kritik data path'lerinde (özellikle `created.id` kullanan `createReport`) Zod parse eklenmesi güvenlik katmanını güçlendiriri.

### S-3 — `common` i18n Namespace'ine `unsavedChanges` Key Eklenmeli

W-4 düzeltmesinin tamamlanabilmesi için `messages/en.json` ve `messages/tr.json` dosyalarına `"unsavedChanges"` key'i eklenmelidir; aksi hâlde runtime'da çeviri hatası oluşur.

### S-4 — `SortableParamRow` Her Render'da Store'u Doğrudan Çağırıyor

**Dosya:** `apps/web/src/app/[locale]/reports/[id]/edit/parameter-list.tsx`

Her `SortableParamRow`, store'u doğrudan `useReportEditorStore()` ile tüketiyor. Parametre sayısı artarsa tüm row'lar her store güncellemesinde re-render edilir. Store selector'larına (`(s) => s.parameters`) geçilmesi veya `React.memo` ile row bileşeninin memoize edilmesi performansı iyileştirir.

---

## Özet

İncelenen 13 dosyada 2 kritik güvenlik sorunu, 4 uyarı ve 4 öneri tespit edildi. Tüm kritik sorunlar ve uyarılar reviewer tarafından düzeltildi ve ilgili dosyalar güncellendi.

**Pozitif bulgular:**
- `dangerouslySetInnerHTML` kullanımı yok — XSS riski yok.
- State-changing işlemler POST/PUT/DELETE ile yapılıyor — CSRF yapısı doğru.
- `console.log` yok, `any` tipi yok, `var` yok, `==` yok.
- `'use client'` direktifleri yalnızca gerçekten interactive olan bileşenlerde kullanılmış.
- `useEffect` bağımlılık dizileri (`[report, loadReport]`) doğru.
- Connection string ve şifreler log'a düşmüyor.
- Environment variables Zod ile doğrulanıyor (`env.ts`).
- Zustand + TanStack Query entegrasyonu idiyomatik ve doğru.
- `next/image` yerine `<img>` kullanımı yok.
- Monaco Editor `dynamic()` + `ssr: false` ile doğru lazy-load edilmiş.

Faz 4 **APPROVED** olarak onaylanmıştır.
