
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processImageFileFast } from '../routes/lab-interpreter';
import OpenAI from 'openai';

vi.mock('openai', () => {
  const mockCompletionsCreate = vi.fn();
  
  return {
    __esModule: true,
    default: class {
      chat = {
        completions: {
          create: mockCompletionsCreate,
        },
      };
    },
  };
});

describe('processImageFileFast', () => {
  it('should read an image file and call the OpenAI API with the correct base64 content', async () => {
    // 1. Setup: Create a temporary image file
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    const imagePath = path.join(tempDir, 'test-image.png');
    const imageBuffer = Buffer.from('fake-image-data');
    await fs.promises.writeFile(imagePath, imageBuffer);

    // 2. Mock OpenAI response
    const MockOpenAI = vi.mocked(OpenAI);
    const mockOpenai = new MockOpenAI();
    const mockResponse = {
      choices: [{ message: { content: 'Extracted text' } }],
    };
    mockOpenai.chat.completions.create.mockResolvedValue(mockResponse);

    // 3. Call the function
    await processImageFileFast(imagePath, mockOpenai, 1, 1);

    // 4. Assertions
    expect(mockOpenai.chat.completions.create).toHaveBeenCalledOnce();
    const callArguments = (mockOpenai.chat.completions.create as vi.Mock).mock.calls[0][0];
    const imageUrl = callArguments.messages[0].content[1].image_url.url;
    const base64Image = imageBuffer.toString('base64');
    expect(imageUrl).toBe(`data:image/png;base64,${base64Image}`);

    // 5. Teardown: Clean up the temporary file and directory
    await fs.promises.unlink(imagePath);
    await fs.promises.rmdir(tempDir);
  });
});
