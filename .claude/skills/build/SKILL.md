---
name: "build"
version: "1.0.0"
description: "Build the current project using the appropriate build command. Auto-detects project type (Node.js, Rust, Go, Python, Java) and runs the correct build command."
tags: ["build", "compile", "typescript", "rust", "go", "python", "java"]
---

# Build Skill

Build the project in the current working directory.

## Supported Project Types

### Node.js/TypeScript
1. Try `npm run build`
2. Fallback to `npm run compile` or `npm run tsc`
3. Final fallback: `tsc` (direct TypeScript compilation)

### Other Languages
- **Rust**: `cargo build --release`
- **Go**: `go build`
- **Python**: `python setup.py build`
- **Java/Maven**: `mvn clean install`
- **Java/Gradle**: `gradle build`

## Post-Build Report

Always provide:
- ✅/❌ Build success status
- Any errors or warnings
- Build output summary
- What was built (e.g., "TypeScript compiled to dist/")
- Build duration if available

## Failure Handling

If build fails:
- Analyze error messages
- Provide specific fix guidance
- Identify missing dependencies
- Suggest correct commands
