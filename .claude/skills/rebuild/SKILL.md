---
name: "rebuild"
version: "1.0.0"
description: "Rebuild the project locally and rebuild the Docker container. Detects bot name from current directory and rebuilds the corresponding Docker service."
tags: ["rebuild", "docker", "containers", "build", "restart"]
---

# Rebuild Skill

Complete rebuild cycle: local build → Docker image rebuild → container restart.

## Process

### 1. Local Build
Build the project in the current working directory using the appropriate build command (same as /build skill).

### 2. Detect Bot Name
Extract bot name from current directory path (e.g., `/home/silver/bots/compensation-bot` → `compensation-bot`)

### 3. Docker Rebuild
Navigate to `/home/silver/bot-manager/docker` and run:
```bash
docker-compose build <bot-name>
docker-compose up -d <bot-name>
```

### 4. Post-Rebuild Report
Provide:
- ✅/❌ Local build status
- ✅/❌ Docker rebuild status
- Container ID after restart
- Current container health status
- Whether to check logs for startup confirmation

## Error Handling

If Docker rebuild fails:
- Check if docker-compose.yml exists in `/home/silver/bot-manager/docker`
- Verify bot name matches service name in docker-compose.yml
- Check Docker daemon is running
- Suggest manual commands if automated approach fails
