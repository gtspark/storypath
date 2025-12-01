// Batch outpaint all scene images to portrait format
const Replicate = require('replicate');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

require('dotenv').config();

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});

const storyId = process.argv[2] || 'e50a11e7-dbee-4f7c-9df7-fdc8905d23ed';
const dbPath = `/opt/vodbase/storypath/stories/${storyId}.db`;
const imageDir = `/var/www/html/storypath/images/generated/${storyId}`;

async function outpaintImage(inputPath, outputPath, prompt) {
    // Read original image dimensions
    const metadata = await sharp(inputPath).metadata();
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    // Target 2:3 portrait ratio
    const targetHeight = Math.round(originalWidth * 1.5);

    if (originalHeight >= targetHeight) {
        console.log(`  Already portrait or square, skipping`);
        return false;
    }

    const paddingTop = Math.floor((targetHeight - originalHeight) / 2);
    const paddingBottom = targetHeight - originalHeight - paddingTop;

    console.log(`  Original: ${originalWidth}x${originalHeight}, Target: ${originalWidth}x${targetHeight}`);
    console.log(`  Adding ${paddingTop}px top, ${paddingBottom}px bottom`);

    // Create extended image with white padding
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

    // Call FLUX Fill Dev
    const prediction = await replicate.predictions.create({
        model: "black-forest-labs/flux-fill-dev",
        input: {
            image: `data:image/png;base64,${extendedBase64}`,
            mask: `data:image/png;base64,${maskBase64}`,
            prompt: prompt + ", seamlessly extend the scene upward into sky and downward into ground/foreground"
        }
    });

    console.log(`  Prediction: ${prediction.id}`);

    // Wait for completion
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

        // Convert to PNG and save
        await sharp(buffer).png().toFile(outputPath);
        console.log(`  Saved: ${outputPath}`);
        return true;
    } else {
        console.error(`  Failed:`, result.error);
        return false;
    }
}

async function main() {
    const db = new Database(dbPath);

    // Get all scenes with images (except scene 1 which is already done)
    const scenes = db.prepare(`
        SELECT scene_number, image_url, image_prompt
        FROM scenes
        WHERE image_url IS NOT NULL
        AND image_url NOT LIKE '%cover%'
        AND scene_number > 1
        ORDER BY scene_number
    `).all();

    console.log(`Found ${scenes.length} scenes to process\n`);

    let processed = 0;
    let failed = 0;
    const startTime = Date.now();

    for (const scene of scenes) {
        console.log(`\nProcessing scene ${scene.scene_number}...`);

        const currentPath = path.join('/var/www/html', scene.image_url);
        const newFilename = `scene-${scene.scene_number}-portrait.png`;
        const newPath = path.join(imageDir, newFilename);
        const newUrl = `/storypath/images/generated/${storyId}/${newFilename}`;

        if (!fs.existsSync(currentPath)) {
            console.log(`  File not found: ${currentPath}`);
            failed++;
            continue;
        }

        try {
            const success = await outpaintImage(currentPath, newPath, scene.image_prompt);

            if (success) {
                // Update database with new path
                db.prepare('UPDATE scenes SET image_url = ? WHERE scene_number = ?')
                    .run(newUrl, scene.scene_number);
                processed++;
            } else {
                failed++;
            }
        } catch (err) {
            console.error(`  Error: ${err.message}`);
            failed++;
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n========================================`);
    console.log(`Processed: ${processed}/${scenes.length}`);
    console.log(`Failed: ${failed}`);
    console.log(`Time: ${elapsed}s`);
    console.log(`Avg per image: ${(elapsed / scenes.length).toFixed(1)}s`);

    // Reset book status to force recompile
    db.prepare("UPDATE stories SET book_status = 'none', book_layout = NULL").run();
    console.log(`\nBook status reset - will recompile on next view`);

    db.close();
}

main().catch(console.error);
