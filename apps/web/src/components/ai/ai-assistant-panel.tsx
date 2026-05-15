'use client'

import { ChevronLeft, ChevronRight, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ReactElement } from 'react'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useExplainQuery, useFixQuery, useSuggestQuery } from '@/hooks/use-ai'

interface AiAssistantPanelProps {
  /** Aktif rapor editörünün seçili veri kaynağı ID'si */
  dataSourceId: string
  /** Mevcut SQL editörün içeriği */
  currentSql: string
  /** "Uygula" butonuna basıldığında editöre SQL yazan callback */
  onApplySql: (sql: string) => void
}

export function AiAssistantPanel({
  dataSourceId,
  currentSql,
  onApplySql,
}: AiAssistantPanelProps): ReactElement {
  const t = useTranslations('ai')
  const [isOpen, setIsOpen] = useState(false)
  const [naturalLanguagePrompt, setNaturalLanguagePrompt] = useState('')
  const [fixErrorMessage, setFixErrorMessage] = useState('')

  const { suggest, state: suggestState, reset: resetSuggest } = useSuggestQuery()
  const {
    explain,
    response: explainResponse,
    isLoading: isExplaining,
    error: explainError,
    reset: resetExplain,
  } = useExplainQuery()
  const { fix, state: fixState, reset: resetFix } = useFixQuery()

  function handleSuggest(): void {
    if (!naturalLanguagePrompt.trim() || !dataSourceId) return
    resetSuggest()
    void suggest({ prompt: naturalLanguagePrompt.trim(), dataSourceId })
  }

  function handleExplain(): void {
    if (!currentSql.trim()) return
    resetExplain()
    void explain({ sql: currentSql })
  }

  function handleFix(): void {
    if (!currentSql.trim() || !fixErrorMessage.trim()) return
    resetFix()
    void fix({ sql: currentSql, errorMessage: fixErrorMessage.trim() })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex">
      {/* Toggle trigger — panel kapalıyken dar bir şerit */}
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center justify-center w-7 shrink-0 bg-muted/40 hover:bg-muted border-l border-border transition-colors"
          aria-label={isOpen ? t('closePanel') : t('openPanel')}
        >
          {isOpen ? (
            <ChevronRight className="h-4 w-4 text-violet-400" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-violet-400" />
          )}
        </button>
      </CollapsibleTrigger>

      {/* Panel içeriği */}
      <CollapsibleContent className="w-80 shrink-0 border-l border-border bg-background overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Başlık */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-foreground">
              {t('panelTitle')}
            </span>
          </div>

          <Tabs defaultValue="suggest">
            <TabsList className="w-full">
              <TabsTrigger value="suggest" className="flex-1 text-xs">
                {t('tabSuggest')}
              </TabsTrigger>
              <TabsTrigger value="explain" className="flex-1 text-xs">
                {t('tabExplain')}
              </TabsTrigger>
              <TabsTrigger value="fix" className="flex-1 text-xs">
                {t('tabFix')}
              </TabsTrigger>
            </TabsList>

            {/* SQL ONERME sekmesi */}
            <TabsContent value="suggest" className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('suggestPromptLabel')}</Label>
                <textarea
                  className="w-full min-h-[80px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={t('suggestPromptPlaceholder')}
                  value={naturalLanguagePrompt}
                  onChange={(e) => setNaturalLanguagePrompt(e.target.value)}
                  disabled={suggestState.isStreaming}
                />
              </div>

              {!dataSourceId && (
                <p className="text-xs text-amber-500">{t('noDataSourceWarning')}</p>
              )}

              <Button
                size="sm"
                className="w-full"
                onClick={handleSuggest}
                disabled={
                  suggestState.isStreaming ||
                  !naturalLanguagePrompt.trim() ||
                  !dataSourceId
                }
              >
                {suggestState.isStreaming ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-3 w-3" />
                    {t('suggestButton')}
                  </>
                )}
              </Button>

              {suggestState.error && (
                <p className="text-xs text-destructive">{suggestState.error}</p>
              )}

              {(suggestState.text || suggestState.isStreaming) && (
                <div className="space-y-2">
                  <pre className="w-full min-h-[80px] max-h-64 overflow-auto rounded-md border border-border bg-muted/50 p-2 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                    {suggestState.text}
                    {suggestState.isStreaming && (
                      <span className="inline-block w-1.5 h-3 bg-violet-400 animate-pulse ml-0.5" />
                    )}
                  </pre>
                  {!suggestState.isStreaming && suggestState.text && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-violet-400 border-violet-400/30 hover:bg-violet-400/10"
                      onClick={() => onApplySql(suggestState.text)}
                    >
                      {t('applyToEditor')}
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ACIKLAMA sekmesi */}
            <TabsContent value="explain" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('explainDescription')}
              </p>

              <Button
                size="sm"
                className="w-full"
                onClick={handleExplain}
                disabled={isExplaining || !currentSql.trim()}
              >
                {isExplaining ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {t('explaining')}
                  </>
                ) : (
                  t('explainButton')
                )}
              </Button>

              {explainError && (
                <p className="text-xs text-destructive">{explainError}</p>
              )}

              {explainResponse && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Türkçe</Label>
                    <p className="text-xs leading-relaxed text-foreground">
                      {explainResponse.turkish}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">English</Label>
                    <p className="text-xs leading-relaxed text-foreground">
                      {explainResponse.english}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* DUZELTME sekmesi */}
            <TabsContent value="fix" className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('fixErrorLabel')}</Label>
                <textarea
                  className="w-full min-h-[60px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={t('fixErrorPlaceholder')}
                  value={fixErrorMessage}
                  onChange={(e) => setFixErrorMessage(e.target.value)}
                  disabled={fixState.isStreaming}
                />
              </div>

              <Button
                size="sm"
                className="w-full"
                onClick={handleFix}
                disabled={
                  fixState.isStreaming ||
                  !currentSql.trim() ||
                  !fixErrorMessage.trim()
                }
              >
                {fixState.isStreaming ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {t('fixing')}
                  </>
                ) : (
                  t('fixButton')
                )}
              </Button>

              {fixState.error && (
                <p className="text-xs text-destructive">{fixState.error}</p>
              )}

              {(fixState.text || fixState.isStreaming) && (
                <div className="space-y-2">
                  <pre className="w-full min-h-[80px] max-h-64 overflow-auto rounded-md border border-border bg-muted/50 p-2 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                    {fixState.text}
                    {fixState.isStreaming && (
                      <span className="inline-block w-1.5 h-3 bg-violet-400 animate-pulse ml-0.5" />
                    )}
                  </pre>
                  {!fixState.isStreaming && fixState.text && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-violet-400 border-violet-400/30 hover:bg-violet-400/10"
                      onClick={() => onApplySql(fixState.text)}
                    >
                      {t('applyToEditor')}
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
