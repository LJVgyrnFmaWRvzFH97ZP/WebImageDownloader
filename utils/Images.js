export const Images = {

  async getInfo(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          blob,
          width: img.width,
          height: img.height
        });
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = blob;
    });
  }

}