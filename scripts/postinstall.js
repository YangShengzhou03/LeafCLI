#!/usr/bin/env node

/**
 * postinstall script - setup and configuration
 *
 * This script is intentionally plain Node.js (no TypeScript, no imports from
 * the main source tree) so that it can run without a build step.
 *
 * It installs leafcli skills to supported AI tools:
 * - Claude Desktop: ~/.claude/plugins/marketplaces/claude-plugins-official/plugins/leafcli/skills/
 * - TRAE IDE: ~/.trae-cn/builtin_skills/
 */

import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync, copyFileSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Helper Functions ────────────────────────────────────────────────────────

function copyDirSync(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function findPackageRoot(startDir) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

function getSkillsDir() {
  // Try to find skills directory relative to this script
  // When installed via npm, skills are in the package root
  const packageRoot = findPackageRoot(__dirname);
  if (packageRoot) {
    const skillsDir = join(packageRoot, 'skills');
    if (existsSync(skillsDir)) {
      return skillsDir;
    }
  }

  // Fallback: check common locations
  const possiblePaths = [
    join(__dirname, '..', 'skills'),
    join(__dirname, '..', '..', 'skills'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

// ── Install Skills to AI Tools ──────────────────────────────────────────────

function installToClaude(skillsDir, home) {
  const claudePluginsDir = join(home, '.claude', 'plugins', 'marketplaces', 'claude-plugins-official', 'plugins');
  const leafcliPluginDir = join(claudePluginsDir, 'leafcli');
  const destSkillsDir = join(leafcliPluginDir, 'skills');
  const pluginJsonPath = join(leafcliPluginDir, '.claude-plugin', 'plugin.json');

  try {
    // Create plugin directory structure
    mkdirSync(join(leafcliPluginDir, '.claude-plugin'), { recursive: true });
    mkdirSync(destSkillsDir, { recursive: true });

    // Create plugin.json if not exists
    if (!existsSync(pluginJsonPath)) {
      const pluginJson = {
        name: 'leafcli',
        description: 'LeafCLI skills for AI-powered CLI operations - browser automation, adapter authoring, and more',
        author: {
          name: 'yangshengzhou',
          email: '3555844679@qq.com'
        }
      };
      writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2), 'utf8');
    }

    // Copy skills
    const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);

    for (const skillName of skillDirs) {
      const srcSkillDir = join(skillsDir, skillName);
      const destSkillDir = join(destSkillsDir, skillName);
      if (!existsSync(destSkillDir)) {
        copyDirSync(srcSkillDir, destSkillDir);
        console.log(`  Installed skill: ${skillName}`);
      } else {
        console.log(`  · Skill already exists: ${skillName}`);
      }
    }

    console.log(`\nSkills installed to Claude Desktop`);
    return true;
  } catch (err) {
    console.log(`  Claude installation skipped: ${err.message}`);
    return false;
  }
}

function installToTrae(skillsDir, home) {
  const traeSkillsDir = join(home, '.trae-cn', 'builtin_skills');

  try {
    if (!existsSync(traeSkillsDir)) {
      mkdirSync(traeSkillsDir, { recursive: true });
    }

    // Copy leafcli-* skills (not smart-search as it has different naming)
    const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('leafcli-'))
      .map(e => e.name);

    for (const skillName of skillDirs) {
      const srcSkillDir = join(skillsDir, skillName);
      const destSkillDir = join(traeSkillsDir, skillName);
      if (!existsSync(destSkillDir)) {
        copyDirSync(srcSkillDir, destSkillDir);
        console.log(`  Installed skill to TRAE: ${skillName}`);
      } else {
        console.log(`  · Skill already exists in TRAE: ${skillName}`);
      }
    }

    console.log(`\nSkills installed to TRAE IDE`);
    return true;
  } catch (err) {
    console.log(`  TRAE installation skipped: ${err.message}`);
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  // Skip in CI environments
  if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) {
    return;
  }

  const home = homedir();

  try {
    // ── Spotify credentials template ────────────────────────────────────
    const leafcliDir = join(home, '.leafcli');
    const spotifyEnvFile = join(leafcliDir, 'spotify.env');
    mkdirSync(leafcliDir, { recursive: true });

    if (!existsSync(spotifyEnvFile)) {
      writeFileSync(spotifyEnvFile,
        `# Spotify credentials — get them at https://developer.spotify.com/dashboard\n` +
        `# Add http://127.0.0.1:8888/callback as a Redirect URI in your Spotify app\n` +
        `SPOTIFY_CLIENT_ID=your_spotify_client_id_here\n` +
        `SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here\n`,
        'utf8'
      );
      console.log(`Spotify credentials template created at ${spotifyEnvFile}`);
    }

    // ── Install Skills to AI Tools ───────────────────────────────────────
    const skillsDir = getSkillsDir();
    if (skillsDir) {
      console.log('\nInstalling leafcli skills to AI tools...\n');

      // Install to Claude Desktop
      installToClaude(skillsDir, home);

      // Install to TRAE IDE
      installToTrae(skillsDir, home);

      console.log('\nSkills installation complete!\n');
    } else {
      console.log('  Skills directory not found, skipping skill installation');
    }

    // ── Browser Bridge setup hint ───────────────────────────────────────
    console.log('  Next step — Browser Bridge setup');
    console.log('  Browser commands (bilibili, zhihu, twitter...) require the extension:');
    console.log('  1. Download: https://github.com/YangShengzhou03/LeafCLI/releases');
    console.log('  2. In Chrome or Chromium, open chrome://extensions → enable Developer Mode → Load unpacked');
    console.log('');
    console.log('  Then run leafcli doctor to verify.');
    console.log('');

  } catch (err) {
    // Setup is best-effort; never fail the package install
    if (process.env.leafcli_VERBOSE) {
      console.error(`Warning: Setup failed: ${err.message}`);
    }
  }
}

main();