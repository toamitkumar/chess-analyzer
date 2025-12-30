/**
 * Application Configuration
 *
 * Central configuration file for app-wide settings.
 * In the future, this will be replaced with user authentication and per-user settings.
 */

/**
 * Target player for analysis
 * TODO: Replace with user authentication system
 * - In development: Read from environment variable or use default
 * - In production: Get from authenticated user session
 */
const TARGET_PLAYER = process.env.TARGET_PLAYER || 'AdvaitKumar1213';

/**
 * API Configuration
 */
const API_CONFIG = {
  port: process.env.PORT || 3000,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
};

/**
 * Analysis Configuration
 */
const ANALYSIS_CONFIG = {
  stockfishDepth: 15,
  analysisTimeout: 10000, // 10 seconds per position
};

/**
 * Feature Flags
 */
const FEATURE_FLAGS = {
  // ADR 005: Win-probability based accuracy calculation
  // Set to true to enable new algorithm, false for legacy centipawn-loss method
  USE_WIN_PROBABILITY_ACCURACY: process.env.USE_WIN_PROBABILITY_ACCURACY === 'true' || false,
};

module.exports = {
  TARGET_PLAYER,
  API_CONFIG,
  ANALYSIS_CONFIG,
  FEATURE_FLAGS,
};
