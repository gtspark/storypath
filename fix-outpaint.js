// Re-outpaint specific scenes with improved prompt
const Replicate = require('replicate');
const sharp = require('sharp');
const fs = require('fs');
const Database = require('better-sqlite3');

require('dotenv').config();

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});

const storyId = 'e50a11e7-dbee-4f7c-9df7-fdc8905d23ed';
const imageDir = `/var/www/html/storypath/images/generated/${storyId}`;

// Scenes to fix
const scenesToFix = [4, 11];

async function outpaintWithBetterPrompt(sceneNumber, originalPrompt) {
    const inputPath = `${imageDir}/scene-${sceneNumber}.png`;
    const outputPath = `${imageDir}/scene-${sceneNumber}-portrait.png`;

    console.log(`\nFixing scene ${sceneNumber}...`);

    const metadata = await sharp(inputPath).metadata();
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    const targetHeight = Math.round(originalWidth * 1.5);

    const paddingTop = Math.floor((targetHeight - originalHeight) / 2);
    const paddingBottom = targetHeight - originalHeight - paddingTop;

    console.log(`  Original: ${originalWidth}x${originalHeight}`);
    console.log(`  Target: ${originalWidth}x${targetHeight}`);

    // Create extended image
    const extendedImage = await sharp(inputPath)
        .extend({
            top: paddingTop,
            bottom: paddingBottom,
            left: 0,
            right: 0,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

    // Create mask
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

    // Try much simpler prompt - describe what to FILL not what NOT to do
    const improvedPrompt = `Fill the masked areas naturally:
- TOP: Continue the sky with clouds, sunset/twilight colors, maybe distant treetops
- BOTTOM: Continue the meadow with wildflowers, grass, a winding path

The existing image shows: ${originalPrompt}

Create a single cohesive vertical landscape. Soft storybook illustration style.`;

    console.log(`  Sending to FLUX Fill Dev...`);

    const prediction = await replicate.predictions.create({
        model: "black-forest-labs/flux-fill-pro",  // Try Pro instead of Dev
        input: {
            image: `data:image/png;base64,${extendedBase64}`,
            mask: `data:image/png;base64,${maskBase64}`,
            prompt: improvedPrompt
        }
    });

    console.log(`  Prediction: ${prediction.id}`);

    let result = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
        await new Promise(r => setTimeout(r, 2000));
        result = await replicate.predictions.get(prediction.id);
        process.stdout.write('.');
    }
    console.log();

    if (result.status === 'succeeded' && result.output) {
        const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
        const response = await fetch(outputUrl);
        const buffer = Buffer.from(await response.arrayBuffer());

        await sharp(buffer).png().toFile(outputPath);
        console.log(`  ✅ Saved: ${outputPath}`);
        return true;
    } else {
        console.error(`  ❌ Failed:`, result.error);
        return false;
    }
}

async function main() {
    const db = new Database(`/opt/vodbase/storypath/stories/${storyId}.db`);

    for (const sceneNum of scenesToFix) {
        const scene = db.prepare('SELECT image_prompt FROM scenes WHERE scene_number = ?').get(sceneNum);
        if (scene) {
            await outpaintWithBetterPrompt(sceneNum, scene.image_prompt);
        }
    }

    // Reset book status
    db.prepare("UPDATE stories SET book_status = 'none', book_layout = NULL").run();
    console.log('\nBook status reset');

    db.close();
}

main().catch(console.error);
