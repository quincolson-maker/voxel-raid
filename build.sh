#!/bin/sh
# Rebuild the minified bundle served by index.html
npx -y esbuild@0.24.0 main.js --bundle --minify --format=esm --alias:three=./three.module.js --outfile=game.min.js
