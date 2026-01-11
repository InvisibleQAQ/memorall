export const MAX_LOG_STORED = 500;
// Detect production mode - disable all logging in production
// Extension.js sets NODE_ENV through webpack DefinePlugin
const IS_PRODUCTION =
	typeof process !== "undefined" &&
	(process.env?.NODE_ENV === "production" || process.env.ENV === "production");
export const SHOW_LOG = !IS_PRODUCTION;
