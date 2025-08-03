#!/usr/bin/env bash
# exit on error
set -e

# This will install dependencies AND automatically run your postinstall script
npm install

# This will start your server in production mode
npm run start
