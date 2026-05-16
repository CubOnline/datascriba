import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockSuggest = vi.fn()
const mockExplain = vi.fn()
const mockFix = vi.fn()
const mockReset = vi.fn()

vi.mock('@/hooks/use-ai', () => ({
  useSuggestQuery: () => ({
    suggest: mockSuggest,
    state: { text: '', isStreaming: false, error: null },
    reset: mockReset,
  }),
  useExplainQuery: () => ({
    explain: mockExplain,
    response: null,
    isLoading: false,
    error: null,
    reset: mockReset,
  }),
  useFixQuery: () => ({
    fix: mockFix,
    state: { text: '', isStreaming: false, error: null },
    reset: mockReset,
  }),
}))

import { AiAssistantPanel } from './ai-assistant-panel'

const defaultProps = {
  dataSourceId: 'ds-1',
  currentSql: 'SELECT * FROM users',
  onApplySql: vi.fn(),
}

describe('AiAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the collapsed toggle trigger button', () => {
    render(<AiAssistantPanel {...defaultProps} />)
    const trigger = screen.getByRole('button', { name: /openPanel/i })
    expect(trigger).toBeDefined()
  })

  it('opens panel on trigger click and shows panel title', () => {
    render(<AiAssistantPanel {...defaultProps} />)
    const trigger = screen.getByRole('button', { name: /openPanel/i })
    fireEvent.click(trigger)
    expect(screen.getByText('panelTitle')).toBeDefined()
  })

  it('shows no-data-source warning when dataSourceId is empty', () => {
    render(<AiAssistantPanel {...defaultProps} dataSourceId="" />)
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    expect(screen.getByText('noDataSourceWarning')).toBeDefined()
  })

  it('suggest button is disabled when prompt textarea is empty', () => {
    render(<AiAssistantPanel {...defaultProps} />)
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    const suggestBtn = screen.getByText('suggestButton').closest('button')
    expect(suggestBtn?.disabled).toBe(true)
  })

  it('calls suggest with prompt and dataSourceId when button clicked', () => {
    render(<AiAssistantPanel {...defaultProps} />)
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    const textareas = screen.getAllByRole('textbox')
    const promptTextarea = textareas[0]
    if (promptTextarea) {
      fireEvent.change(promptTextarea, { target: { value: 'Show all orders' } })
    }

    const suggestBtn = screen.getByText('suggestButton').closest('button')
    if (suggestBtn) fireEvent.click(suggestBtn)

    expect(mockSuggest).toHaveBeenCalledWith({
      prompt: 'Show all orders',
      dataSourceId: 'ds-1',
    })
  })

  it('calls explain with currentSql when explain button clicked', async () => {
    const user = userEvent.setup()
    render(<AiAssistantPanel {...defaultProps} />)

    // Open the panel
    const trigger = screen.getByRole('button', { name: /openPanel/i })
    await user.click(trigger)

    // Switch to the explain tab using userEvent for proper Radix UI interaction
    const explainTab = screen.getByRole('tab', { name: 'tabExplain' })
    await user.click(explainTab)

    // Wait for the explain tab content to become active
    await waitFor(() => {
      expect(screen.getByText('explainButton')).toBeDefined()
    })

    const explainBtn = screen.getByText('explainButton').closest('button')
    if (explainBtn) await user.click(explainBtn)

    expect(mockExplain).toHaveBeenCalledWith({ sql: 'SELECT * FROM users' })
  })
})
