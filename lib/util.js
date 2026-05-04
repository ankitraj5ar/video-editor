const fs = require("fs/promises");
const util = {};

// delete a folder if it exists if not  the function will not throw an error
util.deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {}
};

// delete a folder if it exists if not  the function will not throw an error
util.deleteFolder = async (folderPath) => {
  try {
    await fs.rm(folderPath, { recursive: true });
  } catch (error) {}
};

module.exports = util;
