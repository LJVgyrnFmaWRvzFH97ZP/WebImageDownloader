export const Images = {

  async getImageInfo(url, _src) {
    try {
      const src = _src ?? await this.getImageSrc(url);
      const width = await this.getImageSize(src);
      return { src, width };
    } catch (error) {
      console.error("Error getting image source:", error);
      return null;
    }
  },

  async getImageSrc(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const src = URL.createObjectURL(blob);
      return src;
    } catch (error) {
      console.error("Error getting image source:", error);
      return null;
    }
  },

  async getImageSize(src) {
    const img = new Image();
    img.src = src;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    return img.width;
  },

}