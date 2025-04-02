document.addEventListener("alpine:init", () => {

  Alpine.data("WebImageDownloaderOptions", () => ({

    formats: {
      avaliable: [
        'JPEG',
        'JPG',
        'PNG',
      ],
      default: [
        'JPEG',
        'JPG',
      ],
      selected: null,
    },

    options: [
      {
        key: 'pageSize',
        name: "Page Size",
        desc: "Number of images to display each time.",
        placeholder: '',
        type: 'number',
        value: null,
        default: 20,
      },
      {
        key: 'minimalWidth',
        name: "Minimal Image Width",
        desc: 'Minimal width of images to detect.',
        placeholder: '',
        type: 'number',
        value: null,
        default: 200,
      },
      {
        key: 'rootDir',
        name: "Root Directory",
        desc: 'Base directory where downloaded images will be saved.',
        placeholder: '',
        type: 'text',
        value: null,
        default: '',
      },
      {
        key: 'dir',
        name: "Directory",
        desc: 'Subdirectory format for organizing downloaded images.',
        placeholder: '{domain}/{path[0]} → example.com/gallery',
        type: 'text',
        value: null,
        default: '{domain}/{path[0]}',
      },
      {
        key: 'filename',
        name: "Filename",
        desc: 'Filename format of the downloaded image.',
        placeholder: '{index}-{timestamp}-{original_image_name} → 1-1693498765-photo1',
        type: 'text',
        value: null,
        default: '{timestamp}-{index}-{original_image_name}',
      },
    ],

    async init() {
      const settings = await this.loadSettings();
      this.formats.selected = new Set(settings?.formats || this.formats.default);
      this.options.forEach((option) => {
        const optionValue = settings?.options?.[option.key];
        option.value = optionValue || option.default;
      });
    },

    async loadSettings() {
      const settings = await chrome.storage.sync.get("webImageDownloaderSettings");
      return settings.webImageDownloaderSettings || null;
    },

    async saveSettings() {
      const options = {};
      this.options.forEach((option) => {
        options[option.key] = option.value;
      });
      const settings = {
        formats: Array.from(this.formats.selected),
        options,
      };
      await chrome.storage.sync.set({ webImageDownloaderSettings: settings });
    },

    async resetSettings() {
      this.formats.selected = new Set(this.formats.default);
      this.options.forEach((option) => {
        option.value = option.default;
      });
      await this.saveSettings();
    },

  }));

  Alpine.data("WebImageDownloaderOption", () => ({

    init() {
    },

    setValue(event) {
      if (this.option.type === 'number') {
        this.option.value = parseInt(event.target.value);
      } else {
        this.option.value = event.target.value;
      }
    }

  }));

  Alpine.data("WebImageDownloaderFormat", () => ({

    init() {
    },

    getCheckedStatus() {
      return this.formats.selected?.has(this.format);
    },

    setCheckedStatus(event) {
      if (event.target.checked) {
        this.formats.selected.add(this.format);
      } else {
        this.formats.selected.delete(this.format);
      }
    },

  }));

});