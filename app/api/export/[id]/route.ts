import { NextResponse } from 'next/server'
import { getExportHistory } from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

type ExportFormat = 'json' | 'markdown' | 'pdf'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to export conversations.' }, { status: 401 })
  }

  const { id } = await params
  const chatId = id.trim()
  const url = new URL(request.url)
  const format = (url.searchParams.get('format') ?? 'json') as ExportFormat

  if (!['json', 'markdown', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use json, markdown, or pdf.' }, { status: 400 })
  }

  const result = await getExportHistory(sessionUser.id, chatId)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  const { messages } = result

  if (format === 'json') {
    const payload = {
      chatId,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages,
    }
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="bag-v1-export-${chatId}.json"`,
      },
    })
  }

  if (format === 'markdown') {
    const lines = [
      `# Bag-v1 Conversation Export`,
      `Chat ID: ${chatId}`,
      `Exported: ${new Date().toISOString()}`,
      `Messages: ${messages.length}`,
      '',
      '---',
      '',
    ]

    for (const msg of messages) {
      const roleLabel = msg.role === 'user' ? 'You' : 'Bag-v1'
      const modelInfo = msg.model ? ` (model: ${msg.model})` : ''
      const timeInfo = msg.timestamp ? ` — ${msg.timestamp}` : ''
      lines.push(`## ${roleLabel}${modelInfo}${timeInfo}`)
      lines.push('')
      lines.push(msg.content)
      lines.push('')
      lines.push('---')
      lines.push('')
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="bag-v1-export-${chatId}.md"`,
      },
    })
  }

  // PDF — return JSON with instructions; client-side generation via jspdf
  // (Browser-based PDF generation is handled in the frontend.)
  return NextResponse.json({
    messages,
    chatId,
    format: 'pdf',
    note: 'Generate PDF client-side from the messages array using jspdf.',
  })
}
