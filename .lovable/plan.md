

# Image Generation Plan: Hyper-Realistic Deadpool T-Pose Dive

## Overview

Generate a new high-quality image using the provided cinematic prompt and add it to the project's generated assets folder.

## Technical Approach

### Image Generation
- **Model**: `google/gemini-3-pro-image-preview` (Nano banana pro) - Higher quality model for this detailed cinematic request
- **Prompt**: Use the full user-provided prompt describing the Deadpool/Assassin's Creed crossover in T-pose swan dive with Drizzt's scimitars and Infinity Gauntlet

### Asset Storage
- **Location**: `src/assets/generated/` (consistent with existing generated assets)
- **Filename**: `deadpool-assassin-tpose-dive-v2.jpg` (versioned to distinguish from existing `deadpool-assassin-tpose-dive.jpg`)

### Integration Points
The new image could optionally replace or supplement the existing T-pose image used in:
- `IntroSplashScreen.tsx` - Current "Begin Journey" splash screen background

## Generation Details

| Parameter | Value |
|-----------|-------|
| Model | google/gemini-3-pro-image-preview |
| Output | Base64 PNG/JPEG |
| Style | Hyper-realistic 8K cinematic photograph |
| Key Elements | T-pose dive, dual scimitars (Icingdeath + Twinkle), Infinity Gauntlet, storm background |

## Deliverable

Upon approval, I will:
1. Call the AI image generation endpoint with the detailed prompt
2. Save the generated image to `src/assets/generated/deadpool-assassin-tpose-dive-v2.jpg`
3. Display the result in chat for review

