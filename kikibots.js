const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const https = require('https');
const { setTimeout } = require('timers/promises');

const ADMIN_ID = 7308292609;
const BOT_TOKEN = "8533662019:AAHKsMxXgYH9NmJOwCAwfK-TGsAqi0m-TiM";
const IGNORE_SSL = true;
const WIN_LOSE_CHECK_INTERVAL = 1000;
const MAX_RESULT_WAIT_TIME = 60000;

// ⚡ BALANCE CHECK SETTINGS - IMPROVED
const MAX_BALANCE_RETRIES = 20;
const BALANCE_RETRY_DELAY = 1500;
const BALANCE_API_TIMEOUT = 20000;
const BET_API_TIMEOUT = 29000;
const MAX_BET_RETRIES = 3;
const BET_RETRY_DELAY = 1000;
const MAX_CONSECUTIVE_ERRORS = 15;
const MESSAGE_RATE_LIMIT_SECONDS = 10;
const MAX_TELEGRAM_RETRIES = 3;
const TELEGRAM_RETRY_DELAY = 1000;

// ⚡ FAST MODE SETTINGS - IMPROVED
const FAST_MODE = true;
const QUICK_BALANCE_CHECK = true;
const SKIP_TELEGRAM_CONFIRMATION = false;

// ⚡ Game type အလိုက် မတူတဲ့ delay
const GAME_DELAYS = {
  'TRX': 3000,
  'WINGO30S': 300,
  'WINGO1MIN': 500,
  'WINGO3MIN': 1000,
  'WINGO5MIN': 2000
};

const PLATFORM_CONFIGS = {
  '777BIGWIN': {
    BASE_URL: "https://api.bigwinqaz.com/api/webapi/",
    ALLOWED_USERS_FILE: 'users_777bigwin.json',
    USER_SET_KEY: 'allowed777bigwinIds',
    GAME_NAME: "🎰 777 BIGWIN",
    LOGIN_PREFIX: "95"
  },
  'CKLOTTERY': {
    BASE_URL: "https://ckygjf6r.com/api/webapi/",
    ALLOWED_USERS_FILE: 'users_cklottery.json',
    USER_SET_KEY: 'allowedcklotteryIds',
    GAME_NAME: "🎲 CK LOTTERY",
    LOGIN_PREFIX: "95"
  },
  '6LOTTERY': {
    BASE_URL: "https://6lotteryapi.com/api/webapi/",
    ALLOWED_USERS_FILE: 'users_6lottery.json',
    USER_SET_KEY: 'allowed6lotteryIds',
    GAME_NAME: "🎯 6 LOTTERY",
    LOGIN_PREFIX: "95"
  }
};

// System Mode - FREE or PREMIUM
const SYSTEM_MODE_FILE = 'system_mode.json';
let SYSTEM_MODE = 'FREE';

// User Management
const BANNED_USERS_FILE = 'banned_users.json';
let bannedUsers = new Set();

// Time Settings Storage (Updated to TIME START system)
const TIME_START_FILE = 'time_start_settings.json';
const userTimeStarts = {};

// Channel Configuration
const CHANNEL_CONFIG_FILE = 'channel_config.json';
let requiredChannels = [
  { id: "@KMM_MOD1", name: "🚀 𝐌'_𝐌𝐎𝐃 𝐂𝐡𝐚𝐧𝐧𝐞𝐥 🚀" }
];

// Load system mode
const loadSystemMode = async () => {
  try {
    const data = await fs.readFile(SYSTEM_MODE_FILE, 'utf8');
    const parsed = JSON.parse(data);
    SYSTEM_MODE = parsed.mode || 'FREE';
    log('INFO', `📊 System Mode Loaded: ${SYSTEM_MODE} MODE`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      log('WARNING', `${SYSTEM_MODE_FILE} not found. Starting in FREE MODE`);
      SYSTEM_MODE = 'FREE';
      await saveSystemMode('FREE');
    } else {
      log('ERROR', `🧨 ERROR loading system mode: ${error.message}`);
      SYSTEM_MODE = 'FREE';
    }
  }
};

// Save system mode
const saveSystemMode = async (mode) => {
  try {
    SYSTEM_MODE = mode;
    await fs.writeFile(
      SYSTEM_MODE_FILE,
      JSON.stringify({ mode: SYSTEM_MODE }, null, 2)
    );
    log('INFO', `💾 System Mode Saved: ${SYSTEM_MODE} MODE`);
  } catch (error) {
    log('ERROR', `🧨 ERROR saving system mode: ${error.message}`);
  }
};

// Load banned users
const loadBannedUsers = async () => {
  try {
    const data = await fs.readFile(BANNED_USERS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    bannedUsers = new Set(parsed.banned_ids || []);
    log('INFO', `📂 Loaded ${bannedUsers.size} banned users`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      log('WARNING', `${BANNED_USERS_FILE} not found. Starting fresh`);
      bannedUsers = new Set();
      await saveBannedUsers();
    } else {
      log('ERROR', `🧨 ERROR loading ${BANNED_USERS_FILE}: ${error.message}`);
      bannedUsers = new Set();
    }
  }
};

// Save banned users
const saveBannedUsers = async () => {
  try {
    await fs.writeFile(
      BANNED_USERS_FILE,
      JSON.stringify({ banned_ids: Array.from(bannedUsers) }, null, 2)
    );
    log('INFO', `💾 Saved ${bannedUsers.size} banned users`);
  } catch (error) {
    log('ERROR', `🧨 ERROR saving banned users: ${error.message}`);
  }
};

// Load time start settings
const loadTimeStartSettings = async () => {
  try {
    const data = await fs.readFile(TIME_START_FILE, 'utf8');
    const parsed = JSON.parse(data);
    for (const [userId, starts] of Object.entries(parsed)) {
      userTimeStarts[userId] = starts;
    }
    log('INFO', `📂 Loaded time start settings for ${Object.keys(userTimeStarts).length} users`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      log('WARNING', `${TIME_START_FILE} not found. Starting fresh`);
      await saveTimeStartSettings();
    } else {
      log('ERROR', `🧨 ERROR loading time start settings: ${error.message}`);
    }
  }
};

// Save time start settings
const saveTimeStartSettings = async () => {
  try {
    await fs.writeFile(
      TIME_START_FILE,
      JSON.stringify(userTimeStarts, null, 2)
    );
    log('INFO', `💾 Saved time start settings for ${Object.keys(userTimeStarts).length} users`);
  } catch (error) {
    log('ERROR', `🧨 ERROR saving time start settings: ${error.message}`);
  }
};

// Load channel config
const loadChannelConfig = async () => {
  try {
    const data = await fs.readFile(CHANNEL_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(data);
    requiredChannels = parsed.channels || requiredChannels;
    log('INFO', `📢 Loaded ${requiredChannels.length} required channels from config`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      log('WARNING', `${CHANNEL_CONFIG_FILE} not found. Using default channels`);
      await saveChannelConfig();
    } else {
      log('ERROR', `🧨 ERROR loading channel config: ${error.message}`);
    }
  }
};

// Save channel config
const saveChannelConfig = async () => {
  try {
    await fs.writeFile(
      CHANNEL_CONFIG_FILE,
      JSON.stringify({ channels: requiredChannels }, null, 2)
    );
    log('INFO', `💾 Saved ${requiredChannels.length} channels to config`);
  } catch (error) {
    log('ERROR', `🧨 ERROR saving channel config: ${error.message}`);
  }
};

// Ban user
const banUser = async (userId, username = '') => {
  bannedUsers.add(userId);
  await saveBannedUsers();
  
  if (userSettings[userId]?.running) {
    userSettings[userId].running = false;
    if (userSettings[userId].task) {
      if (typeof userSettings[userId].task === 'object' && typeof userSettings[userId].task.cancel === 'function') {
        userSettings[userId].task.cancel();
      }
      userSettings[userId].task = null;
    }
  }
  
  log('INFO', `🚫 User ${userId} (${username}) has been banned`);
};

// Unban user
const unbanUser = async (userId) => {
  bannedUsers.delete(userId);
  await saveBannedUsers();
  log('INFO', `🎄User ${userId} has been unbanned`);
};

// Check if user is banned
const isUserBanned = (userId) => {
  return bannedUsers.has(userId);
};

// Get user statistics
const getUserStatistics = () => {
  const totalUsers = Object.keys(userSessions).length;
  const activeUsers = Object.values(userSettings).filter(s => s.running).length;
  const bannedCount = bannedUsers.size;
  const inactiveUsers = totalUsers - activeUsers;
  
  return {
    totalUsers,
    activeUsers,
    bannedUsers: bannedCount,
    inactiveUsers
  };
};

// User data structures
const userState = {};
const userTemp = {};
const userSessions = {};
const userSettings = {};
const userPendingBets = {};
const userWaitingForResult = {};
const userStats = {};
const userGameInfo = {};
const userLastResult = {};
const userResultHistory = {};
const userSkippedBets = {};
const userShouldSkipNext = {};
const userBalanceWarnings = {};
const userSkipResultWait = {};
const userSLSkipWaitingForWin = {};
const userStopInitiated = {};
const userCommandLocks = {};

// Silent Mode အတွက်
const userSilentMode = {};
const userProfitMessageId = {};
const userLastProfit = {};

// Session refresh tracking
const userSessionRefreshCount = {};
const userLastSessionRefresh = {};

// Platform-specific allowed user sets
let allowed777bigwinIds = new Set();
let allowedcklotteryIds = new Set();
let allowed6lotteryIds = new Set();
let nextBetTime = null;
let nextBetIssue = null;
let streakBetCount = 0;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const httpsAgent = new https.Agent({
  rejectUnauthorized: !IGNORE_SSL,
  keepAlive: true,
  maxSockets: 50,
  timeout: 30000
});

const log = (level, message) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} - ${level} - ${message}`);
};

// ============================================
// NEW: SESSION MANAGEMENT FUNCTIONS
// ============================================

const refreshUserSession = async (userId) => {
  try {
    const settings = userSettings[userId];
    const platform = settings?.platform;
    const temp = userTemp[userId];
    
    if (!platform || !temp || !temp.password) {
      log('ERROR', `❌ Cannot refresh session for ${userId}: Missing credentials`);
      return null;
    }
    
    const username = userGameInfo[userId]?.username?.replace(PLATFORM_CONFIGS[platform].LOGIN_PREFIX, "") || "";
    if (!username) {
      log('ERROR', `❌ Cannot refresh session for ${userId}: Missing username`);
      return null;
    }
    
    // Check if we refreshed recently (within 1 minute)
    const lastRefresh = userLastSessionRefresh[userId] || 0;
    const now = Date.now();
    if (now - lastRefresh < 60000) {
      log('WARNING', `⚠️ Session refreshed recently for ${userId}, skipping`);
      return userSessions[userId];
    }
    
    log('INFO', `🔄 Attempting to refresh session for user ${userId} (${platform})`);
    
    const [res, newSession] = await loginRequest(platform, username, temp.password);
    
    if (newSession) {
      userSessions[userId] = newSession;
      us
