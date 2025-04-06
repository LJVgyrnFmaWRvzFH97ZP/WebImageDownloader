export const Settings = {

  formats: [],

  options: {
    pageSize: 0,
    minimalWidth: 0,
    filename: '',
    customUrlPatterns: '',
  },

  default: {
    formats: ["JPEG", "JPG", "PNG", "WEBP", "GIF"],
    options: {
      pageSize: 20,
      minimalWidth: 100,
      filename: '{timestamp}-{index}-{original_image_name}',
      customUrlPatterns: 'https://pbs.twimg.com/media/*,https://www.reddit.com/media/*',
    },
  },

  async init() {
    const settings = await this.loadSettings();
    this.updateSettings(settings);
  },

  async loadSettings() {
    const settings = await chrome.storage.sync.get("webImageDownloaderSettings");
    return settings.webImageDownloaderSettings || null;
  },

  async saveSettings(settings) {
    this.updateSettings(settings);
    await chrome.storage.sync.set({ webImageDownloaderSettings: settings });
  },

  updateSettings(settings) {
    this.formats = settings?.formats || this.default.formats;
    Object.keys(this.options).forEach(key => {
      this.options[key] = settings?.options?.[key] || this.default.options[key];
    })
  },

}