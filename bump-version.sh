#!/bin/bash
# Bump version number across all HTML files for cache busting

# Get current version from preview.html
CURRENT_VERSION=$(grep -oP 'css/main.css\?v=\K[0-9]+' preview.html | head -1)
NEW_VERSION=$((CURRENT_VERSION + 1))

echo "Bumping version from v$CURRENT_VERSION to v$NEW_VERSION"

# Update all HTML files
for file in index.html wizard.html preview.html game.html; do
    if [ -f "$file" ]; then
        echo "Updating $file..."
        sed -i "s/\.css?v=[0-9]\+/.css?v=$NEW_VERSION/g" "$file"
        sed -i "s/\.js?v=[0-9]\+/.js?v=$NEW_VERSION/g" "$file"
    fi
done

echo "Done! All files now use v$NEW_VERSION"
