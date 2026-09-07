/**
 * Theme Registry - Register all available themes here
 * 
 * This file is the central registration point for all themes.
 * Each theme should be registered with a unique name and a dynamic import loader.
 */

import { ThemeRegistry } from '@/lib/themes';

// Register the default theme
ThemeRegistry.register('default', () => import('./default/index'));

// Register the beauty theme
ThemeRegistry.register('beauty', () => import('./beauty/index'));
// ThemeRegistry.register('modern', () => import('./modern'));

console.log('[Themes] Registered themes:', ThemeRegistry.getRegisteredThemes());
