import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MarkdownEditor from './MarkdownEditor'

const codeMirrorSpy = vi.fn<[unknown], void>()

vi.mock('@codemirror/lang-markdown', () => ({
  markdown: vi.fn(() => []),
}))

vi.mock('@uiw/react-codemirror', () => ({
  default: (props: unknown) => {
    codeMirrorSpy(props)
    return <div>CodeMirror</div>
  },
}))

describe('MarkdownEditor', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    codeMirrorSpy.mockClear()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('passes through read-only mode to CodeMirror', async () => {
    await act(async () => {
      root.render(
        <MarkdownEditor
          value="Body"
          onChange={vi.fn()}
          placeholder="Write here"
          readOnly
        />
      )
    })

    expect(codeMirrorSpy).toHaveBeenCalledWith(expect.objectContaining({ editable: false, readOnly: true }))
  })
})
