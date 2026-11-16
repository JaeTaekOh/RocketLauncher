/* Rocket Launcher — settings in one place */
window.RL_CONFIG = {
  /* Feedback / contact: GitHub issues until a dedicated site exists */
  feedbackUrl: 'https://github.com/JaeTaekOh/rocketlauncher/issues',
  /* Ad-slot placeholder only (no real ad network). Set false to hide it. */
  showAdSlotPlaceholder: false,
  /* Shared review-lessons API base URL (owner's Cloudflare Worker).
     The MCP server may also override this with ROCKETLAUNCHER_LESSONS_API.
     When empty or unreachable, learning stays on this device only. */
  lessonsApiUrl: 'https://rocket-launcher-lessons.prezentree.workers.dev/api/lessons'
};
