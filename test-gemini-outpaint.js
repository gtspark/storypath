// Test Gemini (Nano Banana) for outpainting
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const fs = require('fs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is required');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const storyId = 'e50a11e7-dbee-4f7c-9df7-fdc8905d23ed';
const imageDir = `/var/www/html/storypath/images/generated/${storyId}`;

async function testGeminiOutpaint() {
    // Use scene 11 which keeps failing with FLUX
    const inputPath = `${imageDir}/scene-11.png`;

    console.log('Testing Gemini image editing for outpainting...\n');

    // Read and prepare the original image
    const imageBuffer = fs.readFileSync(inputPath);
    const base64Image = imageBuffer.toString('base64');

    const metadata = await sharp(inputPath).metadata();
    console.log(`Original: ${metadata.width}x${metadata.height}`);

    // Target dimensions
    const targetHeight = Math.round(metadata.width * 1.5);
    console.log(`Target: ${metadata.width}x${targetHeight}`);

    // Create extended canvas with the original centered
    const paddingTop = Math.floor((targetHeight - metadata.height) / 2);
    const paddingBottom = targetHeight - metadata.height - paddingTop;

    const extendedImage = await sharp(inputPath)
        .extend({
            top: paddingTop,
            bottom: paddingBottom,
            left: 0,
            right: 0,
            background: { r: 200, g: 200, b: 200, alpha: 1 }  // Gray to show edit areas
        })
        .png()
        .toBuffer();

    const extendedBase64 = extendedImage.toString('base64');

    // Save for reference
    fs.writeFileSync('/tmp/gemini-input.png', extendedImage);
    console.log('Saved extended input to /tmp/gemini-input.png\n');

    try {
        // Use gemini-2.0-flash-exp for image generation/editing
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: {
                responseModalities: ["image", "text"],
            }
        });

        const prompt = `Edit this image: The gray areas at the top and bottom need to be filled in naturally.

- TOP gray area: Fill with sky, clouds, and the tops of the willow tree branches extending upward
- BOTTOM gray area: Fill with meadow grass, wildflowers, and mushrooms continuing downward

The CENTER of the image (the magical willow tree scene) should remain UNCHANGED.

Create ONE seamless vertical landscape - do NOT tile or repeat the scene. Just extend the sky up and ground down naturally.`;

        console.log('Sending to Gemini...');

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: extendedBase64
                }
            }
        ]);

        const response = result.response;
        console.log('Response received');

        // Check for image in response
        if (response.candidates && response.candidates[0]) {
            const parts = response.candidates[0].content.parts;

            for (const part of parts) {
                if (part.inlineData) {
                    console.log('Got image back!');
                    const imageData = Buffer.from(part.inlineData.data, 'base64');
                    fs.writeFileSync('/tmp/gemini-outpaint-result.png', imageData);
                    console.log('Saved to /tmp/gemini-outpaint-result.png');
                } else if (part.text) {
                    console.log('Text response:', part.text.substring(0, 200));
                }
            }
        } else {
            console.log('No candidates in response');
            console.log(JSON.stringify(response, null, 2));
        }

    } catch (error) {
        console.error('Gemini error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response, null, 2));
        }
    }
}

testGeminiOutpaint().catch(console.error);
