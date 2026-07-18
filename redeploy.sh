@echo off
echo === Starting Re-deployment ===
git pull origin main
echo === Rebuilding and restarting Docker containers ===
docker compose down
docker compose up --build -d
echo === Re-deployment Completed Successfully ===
