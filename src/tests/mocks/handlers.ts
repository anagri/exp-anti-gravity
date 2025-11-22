import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock Models API
  http.get('https://api.openai.com/v1/models', () => {
    return HttpResponse.json({
      data: [
        { id: 'gpt-3.5-turbo' },
        { id: 'gpt-4' },
        { id: 'gpt-4-turbo' },
        { id: 'text-embedding-ada-002' },
        { id: 'whisper-1' },
        { id: 'dall-e-3' },
      ],
    });
  }),

  // Mock Chat Completions API
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = (await request.json()) as { model: string; stream?: boolean };
    const { model, stream } = body;

    if (stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const chunks = ['Hello ', 'from ', `${model}!`];

          for (const chunk of chunks) {
            const data = JSON.stringify({
              choices: [
                {
                  delta: { content: chunk },
                },
              ],
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new HttpResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
        },
      });
    }

    return HttpResponse.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: `Hello from ${model} (non-streaming)!`,
          },
        },
      ],
    });
  }),
];
