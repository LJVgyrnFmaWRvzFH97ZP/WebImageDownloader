const selectedImages = new Set();

const getPath = (url) => {
  const file = url.split('/').at(-1).split('?')[0];
  return file;
}

document.addEventListener("DOMContentLoaded", () => {

  const port = chrome.runtime.connect({ name: 'popup' });
  const count = document.getElementById('Count');
  const imageList = document.getElementById("imageList");
  const settingsButton = document.getElementById('Settings');
  const saveButton = document.getElementById('SaveButton');
  const saveAllButton = document.getElementById('SaveAllButton');
  const cleanButton = document.getElementById('CleanButton');

  const getShowIndex = (length) => {
    if (length < 28) {
      return {
        start: 0,
        end: length
      }
    } else {
      return {
        start: length - 28,
        end: length,
      }
    }
  }

  const update = (urls) => {
    imageList.innerHTML = "";
    count.innerHTML = urls.length;
    const { start, end } = getShowIndex(urls.length)
    urls.slice(start, end).reverse().forEach((url) => {
      const li = document.createElement("li");
      li.className = "relative";

      const checkIcon = document.createElement("div");
      checkIcon.className = "absolute top-0 right-0 w-4 h-4 border-2 border-gray-100 p-1 bg-green-600 rounded-full hidden";

      const sizeText = document.createElement("span");
      sizeText.className = "absolute bottom-0 right-0 p-1 rounded-md text-[8px] bg-orange-600 text-white font-semibold";

      const img = document.createElement("img");
      img.className = "w-[60px] h-[60px] object-cover rounded-md cursor-pointer";

      fetch(url)
        .then(response => response.blob())
        .then(blob => {
          img.src = URL.createObjectURL(blob);
          img.onload = () => {
            sizeText.textContent = `${img.naturalWidth}`;
          };
        })
        .catch(error => console.error("Image load error:", error));

      img.addEventListener("click", () => {
        if (selectedImages.has(url)) {
          selectedImages.delete(url);
          checkIcon.classList.add("hidden");
        } else {
          selectedImages.add(url);
          checkIcon.classList.remove("hidden");
        }
      });

      li.appendChild(img);
      li.appendChild(checkIcon);
      li.appendChild(sizeText);
      imageList.appendChild(li);
    });
  }

  port.onMessage.addListener((message) => {
    if (message.action === "update") {
      update(message.urls);
    } else if (message.action === 'finish') {
      selectedImages.clear();
    }
  });
  settingsButton.onclick = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  };
  saveButton.onclick = () => {
    port.postMessage({ action: "save", urls: [...selectedImages] });
  };
  saveAllButton.onclick = () => {
    port.postMessage({ action: "save-all" });
  };
  cleanButton.onclick = () => {
    selectedImages.clear();
    port.postMessage({ action: "clean" });
  };
});