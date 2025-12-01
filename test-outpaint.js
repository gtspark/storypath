// Test outpainting models on Replicate
const Replicate = require('replicate');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});

const testImage = '/var/www/html/storypath/images/generated/e50a11e7-dbee-4f7c-9df7-fdc8905d23ed/scene-1.png';
const imageBase64 = fs.readFileSync(testImage).toString('base64');
const imageDataUri = `data:image/png;base64,${imageBase64}`;

// Original: 1344x768 (landscape)
// Target: ~2:3 portrait, keeping width = 1344x2016
// Need to add 624px top + 624px bottom (or distributed)

async function testFluxFillPro() {
    console.log('Testing FLUX Fill Pro...');

    const sharp = require('sharp');

    const originalWidth = 1344;
    const originalHeight = 768;
    const targetHeight = 2016; // 2:3 ratio with 1344 width
    const paddingTop = Math.floor((targetHeight - originalHeight) / 2);
    const paddingBottom = targetHeight - originalHeight - paddingTop;

    // Create extended image with white padding
    const extendedImage = await sharp(testImage)
        .extend({
            top: paddingTop,
            bottom: paddingBottom,
            left: 0,
            right: 0,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

    // Create mask: white where we want to fill (top and bottom), black where original is
    const mask = await sharp({
        create: {
            width: originalWidth,
            height: targetHeight,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
        }
    })
    .composite([
        {
            input: {
                create: {
                    width: originalWidth,
                    height: paddingTop,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            },
            top: 0,
            left: 0
        },
        {
            input: {
                create: {
                    width: originalWidth,
                    height: paddingBottom,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            },
            top: paddingTop + originalHeight,
            left: 0
        }
    ])
    .png()
    .toBuffer();

    const extendedBase64 = extendedImage.toString('base64');
    const maskBase64 = mask.toString('base64');

    fs.writeFileSync('/tmp/extended-image.png', extendedImage);
    fs.writeFileSync('/tmp/mask.png', mask);
    console.log('Saved extended image and mask to /tmp/');

    try {
        // Use predictions API to get proper output
        const prediction = await replicate.predictions.create({
            model: "black-forest-labs/flux-fill-pro",
            input: {
                image: `data:image/png;base64,${extendedBase64}`,
                mask: `data:image/png;base64,${maskBase64}`,
                prompt: "A cozy countryside valley at dawn, rolling hills covered in wildflowers, soft morning sky with gentle clouds above, lush green meadow and colorful flowers below, whimsical storybook style, soft warm colors, peaceful atmosphere",
                steps: 50
            }
        });

        console.log('Prediction created:', prediction.id);

        // Wait for completion
        let result = prediction;
        while (result.status !== 'succeeded' && result.status !== 'failed') {
            await new Promise(r => setTimeout(r, 2000));
            result = await replicate.predictions.get(prediction.id);
            console.log('Status:', result.status);
        }

        if (result.status === 'succeeded' && result.output) {
            const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            console.log('FLUX Fill Pro output URL:', outputUrl);
            const response = await fetch(outputUrl);
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync('/tmp/flux-fill-pro-result.png', buffer);
            console.log('Saved FLUX Fill Pro result to /tmp/flux-fill-pro-result.png');
        } else {
            console.error('FLUX Fill Pro failed:', result.error);
        }
    } catch (err) {
        console.error('FLUX Fill Pro error:', err.message);
    }
}

async function testFluxFillDev() {
    console.log('\nTesting FLUX Fill Dev (cheaper alternative)...');

    const sharp = require('sharp');

    const originalWidth = 1344;
    const originalHeight = 768;
    const targetHeight = 2016;
    const paddingTop = Math.floor((targetHeight - originalHeight) / 2);
    const paddingBottom = targetHeight - originalHeight - paddingTop;

    const extendedImage = await sharp(testImage)
        .extend({
            top: paddingTop,
            bottom: paddingBottom,
            left: 0,
            right: 0,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

    const mask = await sharp({
        create: {
            width: originalWidth,
            height: targetHeight,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
        }
    })
    .composite([
        {
            input: {
                create: {
                    width: originalWidth,
                    height: paddingTop,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            },
            top: 0,
            left: 0
        },
        {
            input: {
                create: {
                    width: originalWidth,
                    height: paddingBottom,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            },
            top: paddingTop + originalHeight,
            left: 0
        }
    ])
    .png()
    .toBuffer();

    const extendedBase64 = extendedImage.toString('base64');
    const maskBase64 = mask.toString('base64');

    try {
        const prediction = await replicate.predictions.create({
            model: "black-forest-labs/flux-fill-dev",
            input: {
                image: `data:image/png;base64,${extendedBase64}`,
                mask: `data:image/png;base64,${maskBase64}`,
                prompt: "A cozy countryside valley at dawn, rolling hills covered in wildflowers, soft morning sky with gentle clouds above, lush green meadow and colorful flowers below, whimsical storybook style, soft warm colors, peaceful atmosphere"
            }
        });

        console.log('Prediction created:', prediction.id);

        let result = prediction;
        while (result.status !== 'succeeded' && result.status !== 'failed') {
            await new Promise(r => setTimeout(r, 2000));
            result = await replicate.predictions.get(prediction.id);
            console.log('Status:', result.status);
        }

        if (result.status === 'succeeded' && result.output) {
            const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            console.log('FLUX Fill Dev output URL:', outputUrl);
            const response = await fetch(outputUrl);
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync('/tmp/flux-fill-dev-result.png', buffer);
            console.log('Saved FLUX Fill Dev result to /tmp/flux-fill-dev-result.png');
        } else {
            console.error('FLUX Fill Dev failed:', result.error);
        }
    } catch (err) {
        console.error('FLUX Fill Dev error:', err.message);
    }
}

async function main() {
    console.log('Starting outpainting tests...\n');
    console.log('Original image: 1344x768 (landscape)');
    console.log('Target: 1344x2016 (portrait 2:3)\n');

    // Run both in parallel
    await Promise.all([
        testFluxFillPro(),
        testFluxFillDev()
    ]);

    console.log('\nDone! Check /tmp/ for results.');
}

main().catch(console.error);
