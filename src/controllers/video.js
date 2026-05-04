const path = require("path");
const crypto = require("crypto");
const fs = require("fs/promises");
const { pipeline } = require("stream/promises");
const util = require("../../lib/util");
const db = require("../DB.js");

const uploadVideo = async (req, res, handleErr) => {
  const fileName = req.headers.filename;
  const extension = path.extname(fileName).substring().toLowerCase();
  const name = path.parse(fileName).name;
  const videoId = crypto.randomBytes(4).toString("hex");
  try {
    await fs.mkdir(`./storage/${videoId}`);
    const fullPath = `./storage/${videoId}/original${extension}`;
    const fileDescriptor = await fs.open(fullPath, "w");
    const fileStream = fileDescriptor.createWriteStream();
    await pipeline(req, fileStream);

    db.update();
    db.videos.unshift({
      id: db.videos.length + 1,
      videoId,
      name,
      extension,
      userId: req.userId,
      extractedAudio: false,
      resizes: {},
    });
    db.save();
    res.status(200).json({
      status: "success",
      videoId,
      message: "Video uploaded successfully",
    });
  } catch (error) {
    await util.deleteFolder(`./storage/${videoId}`);

    if (error.code !== "ECONNRESET") {
      return handleErr(error);
    }
  }
};

const controller = {
  uploadVideo,
};
module.exports = controller;
