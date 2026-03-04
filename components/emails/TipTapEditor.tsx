'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'

interface MergeVar {
  label: string
  token: string
  description: string
}

interface TipTapEditorProps {
  content: string
  onChange: (html: string) => void
  mergeVars?: MergeVar[]
}

export function TipTapEditor({ content, onChange, mergeVars }: TipTapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      TextAlign.configure({ types: ['paragraph'] }),
    ],
    content,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  })

  if (!editor) return null

  function toggleLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('URL do link:', 'https://')
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
          <ToolbarButton
            icon={Bold}
            title="Negrito"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon={Italic}
            title="Italico"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            icon={UnderlineIcon}
            title="Sublinhado"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            icon={LinkIcon}
            title="Link"
            active={editor.isActive('link')}
            onClick={toggleLink}
          />
          <div className="mx-0.5 h-5 w-px bg-gray-200" />
          <ToolbarButton
            icon={List}
            title="Lista"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            icon={ListOrdered}
            title="Lista numerada"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <div className="mx-0.5 h-5 w-px bg-gray-200" />
          <ToolbarButton
            icon={AlignLeft}
            title="Alinhar esquerda"
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          />
          <ToolbarButton
            icon={AlignCenter}
            title="Centralizar"
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          />
          <ToolbarButton
            icon={AlignRight}
            title="Alinhar direita"
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          />
        </div>

        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none px-3 py-2 text-sm focus-within:outline-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none"
        />

        {mergeVars && mergeVars.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t px-2 py-1.5">
            {mergeVars.map((v) => (
              <Tooltip key={v.token}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => editor?.commands.insertContent(v.token)}
                  >
                    {v.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{v.description} ({v.token})</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

function ToolbarButton({
  icon: Icon,
  title,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={`h-7 w-7 ${active ? 'bg-gray-200' : ''}`}
      title={title}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  )
}
